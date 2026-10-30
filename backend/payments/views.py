import json
import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, serializers, status
from rest_framework.decorators import (api_view, authentication_classes,
                                       permission_classes, throttle_classes)
from rest_framework.response import Response

from courses.models import Course

from .gateways import GatewayError, PayDunyaGateway, WaveGateway
from .models import Payment
from .services import CheckoutError, compute_price, start_checkout, sync_with_gateway

logger = logging.getLogger(__name__)


class CheckoutSerializer(serializers.Serializer):
    course_slug = serializers.SlugField()
    gateway = serializers.ChoiceField(choices=['WAVE', 'PAYDUNYA'])
    coupon_code = serializers.CharField(required=False, allow_blank=True, max_length=50)


class PaymentSerializer(serializers.ModelSerializer):
    course = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'amount', 'currency', 'status', 'gateway', 'checkout_url',
                  'description', 'created_at', 'completed_at', 'error_message', 'course']

    def get_course(self, obj):
        purchase = getattr(obj, 'course_purchase', None)
        if not purchase:
            return None
        return {'slug': purchase.course.slug, 'title': purchase.course.title}


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def available_methods(request):
    """Moyens de paiement configurés sur ce serveur"""
    methods = []
    if WaveGateway().configured:
        methods.append({'code': 'WAVE', 'label': 'Wave'})
    if PayDunyaGateway().configured:
        methods.append({'code': 'PAYDUNYA', 'label': 'Orange Money, Free Money, carte (PayDunya)'})
    return Response(methods)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def quote(request):
    """Prix final d'un cours avec un code promo éventuel"""
    course = get_object_or_404(Course, slug=request.data.get('course_slug', ''), status='PUBLISHED')
    try:
        price, coupon, discount = compute_price(course, request.user, request.data.get('coupon_code', ''))
    except CheckoutError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'original_price': course.price, 'discount': discount,
                     'final_price': price, 'currency': course.currency})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def checkout(request):
    """Crée un paiement et renvoie l'URL de la passerelle vers laquelle rediriger l'utilisateur"""
    ser = CheckoutSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    course = get_object_or_404(Course, slug=ser.validated_data['course_slug'])
    try:
        payment = start_checkout(user=request.user, course=course,
                                 gateway_name=ser.validated_data['gateway'],
                                 coupon_code=ser.validated_data.get('coupon_code', ''))
    except CheckoutError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payment_detail(request, pk):
    """État d'un paiement ; relit la passerelle s'il est encore en cours (page de retour)"""
    payment = get_object_or_404(Payment, pk=pk, user=request.user)
    if payment.status in (Payment.Status.PENDING, Payment.Status.PROCESSING):
        try:
            payment = sync_with_gateway(payment)
        except GatewayError as exc:
            logger.warning('Sync paiement %s impossible : %s', payment.id, exc)
    return Response(PaymentSerializer(payment).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_payments(request):
    payments = Payment.objects.filter(user=request.user).select_related('course_purchase__course')[:50]
    return Response(PaymentSerializer(payments, many=True).data)


# --- Webhooks (appelés par les passerelles, sans authentification JWT) --------

@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def wave_webhook(request):
    raw = request.body
    if not WaveGateway.verify_webhook(raw, request.headers.get('Wave-Signature', ''),
                                      settings.WAVE_WEBHOOK_SECRET):
        return Response({'error': 'signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        event = json.loads(raw)
    except ValueError:
        return Response({'error': 'JSON invalide'}, status=status.HTTP_400_BAD_REQUEST)
    data = event.get('data') or {}
    payment = Payment.objects.filter(gateway='WAVE', gateway_transaction_id=data.get('id', '')).first()
    if not payment and data.get('client_reference'):
        payment = Payment.objects.filter(gateway='WAVE', pk=data['client_reference']).first()
    if payment:
        try:
            sync_with_gateway(payment)  # on relit l'état chez Wave plutôt que de croire le corps
        except GatewayError as exc:
            logger.warning('Webhook Wave : sync impossible (%s)', exc)
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)  # Wave réessaiera
    return Response({'received': True})


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def paydunya_webhook(request):
    """IPN PayDunya : formulaire avec data[hash], data[invoice][token]…"""
    post = request.POST
    received_hash = post.get('data[hash]', '')
    token = post.get('data[invoice][token]', '')
    if not received_hash and isinstance(request.data, dict):
        data = request.data.get('data') or {}
        received_hash = data.get('hash', '')
        token = (data.get('invoice') or {}).get('token', '')
    gateway = PayDunyaGateway()
    if not gateway.verify_ipn_hash(received_hash):
        return Response({'error': 'hash invalide'}, status=status.HTTP_401_UNAUTHORIZED)
    payment = Payment.objects.filter(gateway='PAYDUNYA', gateway_transaction_id=token).first()
    if payment:
        try:
            sync_with_gateway(payment)
        except GatewayError as exc:
            logger.warning('IPN PayDunya : sync impossible (%s)', exc)
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'received': True})
