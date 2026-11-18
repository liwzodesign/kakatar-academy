import json
import logging
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from courses.models import Course
from users.permissions import IsAdminUser, IsFormateurUser

from .gateways import PayDunyaGateway, StripeGateway, WaveGateway, available_gateways
from .models import Commission, Coupon, Payment, Subscription
from .serializers import (
    CheckoutSerializer, CommissionSerializer, CouponSerializer, CouponValidationSerializer, PaymentSerializer,
    RefundSerializer, SubscriptionSerializer,
)
from .services import (
    PaymentError, fulfill_payment, mark_failed, refresh_payment_status, refund_payment, resolve_coupon,
    start_course_checkout, start_subscription_checkout,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration publique
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_config(request):
    return Response({
        'gateways': available_gateways(),
        'currency': settings.DEFAULT_CURRENCY,
        'plans': [{'code': code, **plan} for code, plan in settings.SUBSCRIPTION_PLANS.items()],
        'stripe_publishable_key': settings.STRIPE_PUBLISHABLE_KEY,
    })


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def checkout(request):
    """
    Démarre un paiement et renvoie l'URL de la page de paiement.
    Corps : {"gateway": "WAVE", "course_slug": "..."} ou {"gateway": "STRIPE", "plan": "PREMIUM", "months": 3}
    """
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        if data.get('course_slug'):
            course = get_object_or_404(Course, slug=data['course_slug'], status=Course.Status.PUBLISHED)
            payment, url = start_course_checkout(request.user, course, data['gateway'], data['coupon_code'])
        else:
            payment, url = start_subscription_checkout(request.user, data['plan'], data['months'], data['gateway'],
                                                       data['coupon_code'])
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    payment.refresh_from_db()
    return Response({'payment': PaymentSerializer(payment).data, 'checkout_url': url},
                    status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payment_status(request, pk):
    """Statut d'un paiement ; interroge la passerelle si encore en attente (retour utilisateur)."""
    payment = get_object_or_404(Payment, pk=pk, user=request.user)
    payment = refresh_payment_status(payment)
    return Response(PaymentSerializer(payment).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sandbox_confirm(request, pk):
    """Confirme (ou annule) un paiement simulé. Uniquement si le sandbox est autorisé."""
    if not settings.PAYMENTS_ALLOW_SANDBOX:
        return Response({'error': 'Sandbox désactivé'}, status=status.HTTP_403_FORBIDDEN)
    payment = get_object_or_404(Payment, pk=pk, user=request.user, is_sandbox=True)
    if request.data.get('action') == 'cancel':
        mark_failed(payment, 'Annulé par l\'utilisateur (sandbox)')
    else:
        fulfill_payment(payment, {'sandbox': True})
    payment.refresh_from_db()
    return Response(PaymentSerializer(payment).data)


class MyPaymentsView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).select_related('user', 'course_purchase__course')


# ---------------------------------------------------------------------------
# Webhooks (appelés par les passerelles ; pas d'authentification JWT)
# ---------------------------------------------------------------------------
@csrf_exempt
def stripe_webhook(request):
    gateway = StripeGateway()
    try:
        event = gateway.parse_webhook(request.body, request.META.get('HTTP_STRIPE_SIGNATURE', ''))
    except Exception:
        logger.warning('Webhook Stripe : signature invalide')
        return HttpResponse(status=400)
    obj = event['data']['object']
    payment_id = (obj.get('metadata') or {}).get('payment_id') or obj.get('client_reference_id')
    payment = Payment.objects.filter(pk=payment_id).first() if payment_id else None
    if payment:
        if event['type'] in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') \
                and obj.get('payment_status') == 'paid':
            fulfill_payment(payment, {'stripe_event': event['id']})
        elif event['type'] in ('checkout.session.expired', 'checkout.session.async_payment_failed'):
            mark_failed(payment, event['type'])
    return HttpResponse(status=200)


@csrf_exempt
def paydunya_webhook(request):
    """IPN PayDunya : on valide le hash puis on reconfirme via l'API (source de vérité)."""
    data = request.POST
    if not PayDunyaGateway.valid_ipn_hash(data.get('data[hash]', '')):
        return HttpResponse(status=400)
    token = data.get('data[invoice][token]', '')
    payment = Payment.objects.filter(gateway_transaction_id=token).first() if token else None
    if payment:
        refresh_payment_status(payment)
    return HttpResponse(status=200)


@csrf_exempt
def wave_webhook(request):
    if not WaveGateway.valid_signature(request.body, request.META.get('HTTP_WAVE_SIGNATURE', '')):
        return HttpResponse(status=400)
    try:
        event = json.loads(request.body)
    except ValueError:
        return HttpResponse(status=400)
    session = event.get('data') or {}
    payment = Payment.objects.filter(pk=session.get('client_reference')).first() \
        if session.get('client_reference') else None
    if payment:
        if event.get('type') == 'checkout.session.completed' and session.get('payment_status') == 'succeeded':
            fulfill_payment(payment, {'wave_event': event.get('id')})
        elif event.get('type') == 'checkout.session.payment_failed':
            mark_failed(payment, 'Wave : paiement échoué')
    return HttpResponse(status=200)


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_coupon(request):
    serializer = CouponValidationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    course = None
    amount = data.get('amount') or Decimal('0')
    if data.get('course_slug'):
        course = get_object_or_404(Course, slug=data['course_slug'])
        amount = course.price
    try:
        coupon, discount = resolve_coupon(data['code'], request.user, course, amount)
    except PaymentError as exc:
        return Response({'valid': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'valid': True, 'code': coupon.code, 'discount': discount, 'final_amount': amount - discount,
                     'discount_display': coupon.get_discount_display()})


class CouponListCreateView(generics.ListCreateAPIView):
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Coupon.objects.all()


class CouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Coupon.objects.all()


class InstructorCouponListCreateView(generics.ListCreateAPIView):
    """Codes promo du formateur, limités à ses cours."""
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_serializer_class(self):
        from .serializers import InstructorCouponSerializer
        return InstructorCouponSerializer

    def get_queryset(self):
        return Coupon.objects.filter(created_by=self.request.user).prefetch_related('applicable_courses')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InstructorCouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]

    def get_serializer_class(self):
        from .serializers import InstructorCouponSerializer
        return InstructorCouponSerializer

    def get_queryset(self):
        return Coupon.objects.filter(created_by=self.request.user)


# ---------------------------------------------------------------------------
# Abonnements
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_subscription(request):
    sub = Subscription.objects.active_for(request.user).order_by('-end_date').first()
    history = Subscription.objects.filter(user=request.user)[:10]
    return Response({
        'active': SubscriptionSerializer(sub).data if sub else None,
        'history': SubscriptionSerializer(history, many=True).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_subscription(request):
    """Désactive le renouvellement : l'accès reste actif jusqu'à la date de fin."""
    updated = Subscription.objects.active_for(request.user).update(auto_renew=False)
    if not updated:
        return Response({'error': 'Aucun abonnement actif'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'message': "Renouvellement automatique désactivé. L'accès reste actif jusqu'à échéance."})


# ---------------------------------------------------------------------------
# Revenus formateur
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_earnings(request):
    commissions = Commission.objects.filter(instructor=request.user) \
        .select_related('payment__user', 'payment__course_purchase__course')
    totals = commissions.aggregate(gross=Sum('total_amount'), net=Sum('instructor_amount'),
                                   paid=Sum('instructor_amount', filter=Q(is_paid=True)))
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = commissions.filter(created_at__gte=month_start).aggregate(net=Sum('instructor_amount'))['net'] or 0
    return Response({
        'gross_total': totals['gross'] or 0,
        'net_total': totals['net'] or 0,
        'paid_out': totals['paid'] or 0,
        'pending_payout': (totals['net'] or 0) - (totals['paid'] or 0),
        'this_month': this_month,
        'commission_rate': settings.PLATFORM_COMMISSION_RATE,
        'recent': CommissionSerializer(commissions[:20], many=True).data,
    })


# ---------------------------------------------------------------------------
# Administration
# ---------------------------------------------------------------------------
class AdminPaymentListView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filterset_fields = ['status', 'gateway', 'type']
    search_fields = ['reference', 'user__email', 'description']

    def get_queryset(self):
        return Payment.objects.select_related('user', 'course_purchase__course')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_refund(request, pk):
    payment = get_object_or_404(Payment, pk=pk)
    serializer = RefundSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        payment = refund_payment(payment, serializer.validated_data['reason'])
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(PaymentSerializer(payment).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_mark_commissions_paid(request):
    """Marque comme versées les commissions d'un formateur (après virement)."""
    instructor_id = request.data.get('instructor_id')
    if not instructor_id:
        return Response({'error': 'instructor_id requis'}, status=status.HTTP_400_BAD_REQUEST)
    count = Commission.objects.filter(instructor_id=instructor_id, is_paid=False) \
        .update(is_paid=True, paid_at=timezone.now())
    return Response({'updated': count})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_payouts(request):
    """Montants dus à chaque formateur."""
    rows = (Commission.objects.filter(is_paid=False).values('instructor_id', 'instructor__first_name',
                                                            'instructor__last_name', 'instructor__email')
            .annotate(amount=Sum('instructor_amount'), sales=Count('id')).order_by('-amount'))
    return Response([{
        'instructor_id': str(r['instructor_id']),
        'name': f"{r['instructor__first_name']} {r['instructor__last_name']}".strip(),
        'email': r['instructor__email'], 'amount': r['amount'], 'sales': r['sales'],
    } for r in rows])


# ---------------------------------------------------------------------------
# Demandes de versement (formateur → admin)
# ---------------------------------------------------------------------------
def _payout_dict(p):
    return {
        'id': str(p.id), 'amount': p.amount, 'currency': p.currency, 'method': p.method,
        'method_display': p.get_method_display(), 'account': p.account, 'account_name': p.account_name,
        'status': p.status, 'status_display': p.get_status_display(), 'admin_note': p.admin_note,
        'transaction_reference': p.transaction_reference, 'processed_at': p.processed_at, 'created_at': p.created_at,
        'instructor': {'id': str(p.instructor_id), 'name': p.instructor.get_full_name(), 'email': p.instructor.email},
        'sales': p.commissions.count(),
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def my_payout_requests(request):
    """
    GET : solde disponible + historique des demandes.
    POST {method, account, account_name} : demande le versement de tout le solde disponible.
    """
    from django.db import transaction
    from .models import PayoutRequest

    available_qs = Commission.objects.filter(instructor=request.user, is_paid=False, payout_request__isnull=True)
    if not settings.PAYMENTS_ALLOW_SANDBOX:
        # En production, les ventes simulées ne donnent jamais lieu à un vrai versement
        available_qs = available_qs.filter(payment__is_sandbox=False)
    available = available_qs.aggregate(s=Sum('instructor_amount'))['s'] or 0

    if request.method == 'GET':
        requests_ = PayoutRequest.objects.filter(instructor=request.user).select_related('instructor')[:20]
        last = requests_[0] if requests_ else None
        return Response({
            'available': available, 'minimum': settings.PAYOUT_MINIMUM,
            'has_pending': PayoutRequest.objects.filter(instructor=request.user, status='PENDING').exists(),
            'last_account': {'method': last.method, 'account': last.account, 'account_name': last.account_name} if last else None,
            'requests': [_payout_dict(p) for p in requests_],
        })

    method = request.data.get('method')
    account = (request.data.get('account') or '').strip()
    account_name = (request.data.get('account_name') or '').strip()
    if method not in PayoutRequest.Method.values or len(account) < 6 or len(account_name) < 2:
        return Response({'error': 'Moyen de versement, numéro (ou IBAN) et titulaire sont requis.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if PayoutRequest.objects.filter(instructor=request.user, status='PENDING').exists():
        return Response({'error': 'Une demande est déjà en cours de traitement.'}, status=status.HTTP_400_BAD_REQUEST)
    if available < settings.PAYOUT_MINIMUM:
        return Response({'error': f'Solde insuffisant : minimum {settings.PAYOUT_MINIMUM} FCFA.'},
                        status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        payout = PayoutRequest.objects.create(instructor=request.user, amount=available, method=method,
                                              account=account[:64], account_name=account_name[:120])
        available_qs.update(payout_request=payout)
    from notifications.services import notify
    from users.models import User
    for admin in User.objects.filter(role='ADMIN', is_active=True):
        notify(admin, 'PAYMENT', 'Nouvelle demande de versement',
               f'{request.user.get_full_name()} — {available} FCFA', '/payments?tab=payouts')
    return Response(_payout_dict(payout), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_payout_requests(request):
    from .models import PayoutRequest
    qs = PayoutRequest.objects.select_related('instructor')
    wanted = request.query_params.get('status', 'PENDING')
    if wanted != 'ALL':
        qs = qs.filter(status=wanted)
    return Response([_payout_dict(p) for p in qs[:200]])


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_process_payout(request, pk):
    """Corps : {"action": "paid", "transaction_reference": "..."} ou {"action": "reject", "admin_note": "..."}"""
    from django.db import transaction
    from notifications.services import notify
    from .models import PayoutRequest

    payout = get_object_or_404(PayoutRequest.objects.select_related('instructor'), pk=pk, status='PENDING')
    action = request.data.get('action')
    note = (request.data.get('admin_note') or '').strip()[:300]
    with transaction.atomic():
        if action == 'paid':
            payout.status = PayoutRequest.Status.PAID
            payout.transaction_reference = (request.data.get('transaction_reference') or '').strip()[:100]
            payout.commissions.update(is_paid=True, paid_at=timezone.now())
            message = f'{payout.amount} FCFA envoyés sur votre compte {payout.get_method_display()}.'
        elif action == 'reject':
            if not note:
                return Response({'error': 'Indiquez le motif du refus.'}, status=status.HTTP_400_BAD_REQUEST)
            payout.status = PayoutRequest.Status.REJECTED
            payout.commissions.update(payout_request=None)  # le solde redevient disponible
            message = note
        else:
            return Response({'error': 'Action inconnue.'}, status=status.HTTP_400_BAD_REQUEST)
        payout.admin_note = note
        payout.processed_at = timezone.now()
        payout.save()
    notify(payout.instructor, 'PAYMENT',
           'Versement effectué 💸' if payout.status == 'PAID' else 'Demande de versement refusée', message, '/analytics')
    return Response(_payout_dict(payout))
