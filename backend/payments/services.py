"""Logique métier des paiements : création d'un checkout et validation idempotente."""
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from notifications.services import notify

from .gateways import GatewayError, get_gateway
from .models import Commission, Coupon, CouponUsage, CoursePurchase, Payment, Subscription

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    pass


def resolve_coupon(code, user, course=None, amount=Decimal('0')):
    """Renvoie (coupon, remise) ou lève PaymentError si le code est invalide."""
    if not code:
        return None, Decimal('0')
    coupon = Coupon.objects.filter(code__iexact=code.strip()).first()
    if not coupon or not coupon.can_use_for_user(user):
        raise PaymentError('Code promo invalide ou expiré.')
    if course is not None and not coupon.applies_to(course):
        raise PaymentError("Ce code promo ne s'applique pas à ce cours.")
    discount = coupon.calculate_discount(amount)
    if discount <= 0:
        raise PaymentError(f'Montant minimum pour ce code : {coupon.minimum_amount}.')
    return coupon, discount


@transaction.atomic
def start_course_checkout(user, course, gateway_code, coupon_code=''):
    """Crée un paiement en attente pour un cours et renvoie (payment, url_de_paiement)."""
    from courses.models import Enrollment

    if course.is_free():
        raise PaymentError('Ce cours est gratuit : inscrivez-vous directement.')
    if course.instructor_id == user.id:
        raise PaymentError("Vous êtes l'auteur de ce cours.")
    if Enrollment.objects.filter(user=user, course=course, status__in=['ACTIVE', 'COMPLETED']).exists():
        raise PaymentError('Vous êtes déjà inscrit à ce cours.')
    if not course.can_enroll():
        raise PaymentError('Ce cours est complet.')

    original = course.original_price if course.original_price and course.original_price > course.price else course.price
    coupon, coupon_discount = resolve_coupon(coupon_code, user, course, course.price)
    final = max(course.price - coupon_discount, Decimal('0'))

    payment = Payment.objects.create(
        user=user, amount=final, currency=course.currency, type=Payment.Type.COURSE_PURCHASE,
        gateway=gateway_code, description=f'Cours : {course.title}',
        metadata={'course_id': str(course.id), 'coupon': coupon.code if coupon else ''},
    )
    CoursePurchase.objects.create(
        payment=payment, course=course, original_price=original, final_price=final,
        discount_amount=original - course.price, coupon_code=coupon.code if coupon else '',
        coupon_discount=coupon_discount,
        discount_percentage=round((original - final) * 100 / original, 2) if original else 0,
    )

    if final == 0:  # coupon à 100 %
        payment.gateway_response = {'free_with_coupon': True}
        payment.save(update_fields=['gateway_response'])
        fulfill_payment(payment)
        return payment, None

    return payment, _open_checkout(payment, gateway_code)


@transaction.atomic
def start_subscription_checkout(user, plan, months, gateway_code, coupon_code=''):
    plans = settings.SUBSCRIPTION_PLANS
    if plan not in plans:
        raise PaymentError('Plan inconnu.')
    if months not in (1, 3, 6, 12):
        raise PaymentError('Durée invalide (1, 3, 6 ou 12 mois).')
    monthly = Decimal(plans[plan]['monthly_price'])
    amount = monthly * months
    if months == 12:
        amount = (amount * Decimal('0.8')).quantize(Decimal('1'))  # 2 mois offerts environ
    coupon, discount = resolve_coupon(coupon_code, user, None, amount)
    final = max(amount - discount, Decimal('0'))
    payment = Payment.objects.create(
        user=user, amount=final, currency=settings.DEFAULT_CURRENCY, type=Payment.Type.SUBSCRIPTION,
        gateway=gateway_code, description=f"Abonnement {plans[plan]['name']} ({months} mois)",
        metadata={'plan': plan, 'months': months, 'monthly_price': str(monthly),
                  'coupon': coupon.code if coupon else '', 'coupon_discount': str(discount)},
    )
    if final == 0:
        fulfill_payment(payment)
        return payment, None
    return payment, _open_checkout(payment, gateway_code)


@transaction.atomic
def start_item_checkout(user, payment_type, amount, currency, description, seller, metadata, gateway_code):
    """
    Paiement générique (réservation de session, commande marketplace).
    `metadata` doit contenir l'identifiant de l'objet à valider (registration_id / order_id).
    """
    payment = Payment.objects.create(
        user=user, amount=amount, currency=currency, type=payment_type, gateway=gateway_code,
        description=description, metadata={**metadata, 'seller_id': str(seller.id)},
    )
    return payment, _open_checkout(payment, gateway_code)


@transaction.atomic
def start_path_checkout(user, path, gateway_code, coupon_code=''):
    """Paiement d'un parcours (tous ses cours en une fois, au prix du parcours)."""
    courses = path.ordered_courses()
    if all(_already_owns(user, c) for c in courses):
        raise PaymentError('Vous suivez déjà tous les cours de ce parcours.')
    payment = Payment.objects.create(
        user=user, amount=path.price, currency=path.currency, type=Payment.Type.PATH_PURCHASE, gateway=gateway_code,
        description=f'Parcours : {path.title}', metadata={'path_id': str(path.id)},
    )
    return payment, _open_checkout(payment, gateway_code)


def _already_owns(user, course):
    from courses.models import Enrollment
    return course.instructor_id == user.id or Enrollment.objects.filter(
        user=user, course=course, status__in=['ACTIVE', 'COMPLETED']).exists()


def _fulfill_path(payment):
    """Inscription à tous les cours du parcours ; le montant est réparti entre les formateurs
    au prorata du prix de leurs cours (part égale si tous les cours sont gratuits)."""
    from collections import defaultdict
    from courses.views import enroll_user
    from paths.models import LearningPath

    path = LearningPath.objects.filter(id=(payment.metadata or {}).get('path_id')).first()
    if not path:
        return
    courses = path.ordered_courses()
    for course in courses:
        if course.instructor_id != payment.user_id:
            enroll_user(payment.user, course)
    total = sum((c.price for c in courses), Decimal('0'))
    shares = defaultdict(Decimal)
    for course in courses:
        weight = (course.price / total) if total else Decimal(1) / len(courses)
        shares[course.instructor] += (payment.amount * weight).quantize(Decimal('0.01'))
    for instructor, amount in shares.items():
        if amount > 0:
            _create_commission(payment, instructor, amount)


def _open_checkout(payment, gateway_code):
    try:
        gateway = get_gateway(gateway_code)
        result = gateway.create_checkout(payment)
    except GatewayError as exc:
        payment.status = Payment.Status.FAILED
        payment.error_message = str(exc)
        payment.save(update_fields=['status', 'error_message'])
        raise PaymentError(f'Paiement impossible : {exc}') from exc
    payment.gateway_transaction_id = result.transaction_id
    payment.checkout_url = result.checkout_url
    payment.gateway_response = result.raw or {}
    payment.is_sandbox = gateway.code == 'SANDBOX'
    payment.save(update_fields=['gateway_transaction_id', 'checkout_url', 'gateway_response', 'is_sandbox'])
    return result.checkout_url


def refresh_payment_status(payment):
    """Interroge la passerelle (au retour de l'utilisateur) et valide si payé."""
    if payment.status != Payment.Status.PENDING or payment.is_sandbox:
        return payment
    try:
        status = get_gateway(payment.gateway).verify(payment)
    except Exception:
        logger.exception('Vérification du paiement %s impossible', payment.id)
        return payment
    if status == 'COMPLETED':
        fulfill_payment(payment)
    elif status == 'FAILED':
        mark_failed(payment, 'Paiement refusé ou expiré')
    payment.refresh_from_db()
    return payment


def mark_failed(payment, message=''):
    Payment.objects.filter(pk=payment.pk, status=Payment.Status.PENDING).update(
        status=Payment.Status.FAILED, error_message=message, updated_at=timezone.now())


@transaction.atomic
def fulfill_payment(payment, gateway_payload=None):
    """
    Valide un paiement : idempotent (plusieurs webhooks / retours ne créent rien en double).
    - achat de cours : inscription + commission formateur
    - abonnement : création ou prolongation
    - coupon : enregistrement de l'utilisation
    """
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == Payment.Status.COMPLETED:
        return payment
    if payment.status not in (Payment.Status.PENDING, Payment.Status.PROCESSING, Payment.Status.FAILED):
        return payment

    payment.status = Payment.Status.COMPLETED
    payment.completed_at = timezone.now()
    if gateway_payload:
        payment.gateway_response = {**(payment.gateway_response or {}), 'confirmation': gateway_payload}
    payment.save(update_fields=['status', 'completed_at', 'gateway_response'])

    coupon_code = (payment.metadata or {}).get('coupon')
    if payment.type == Payment.Type.COURSE_PURCHASE:
        _fulfill_course(payment)
    elif payment.type == Payment.Type.SUBSCRIPTION:
        _fulfill_subscription(payment)
    elif payment.type == Payment.Type.SESSION_BOOKING:
        from sessions_live.services import confirm_paid_registration
        registration = confirm_paid_registration(payment)
        if registration:
            _create_commission(payment, registration.session.instructor)
    elif payment.type == Payment.Type.PATH_PURCHASE:
        _fulfill_path(payment)
    elif payment.type == Payment.Type.COHORT_ENROLLMENT:
        from cohorts.services import confirm_paid_membership
        membership = confirm_paid_membership(payment)
        if membership:
            _create_commission(payment, membership.cohort.course.instructor)
    elif payment.type == Payment.Type.MARKETPLACE_ORDER:
        from marketplace.services import mark_order_paid
        order = mark_order_paid(payment)
        if order:
            _create_commission(payment, order.product.seller)

    if coupon_code:
        coupon = Coupon.objects.filter(code__iexact=coupon_code).first()
        if coupon:
            purchase = getattr(payment, 'course_purchase', None)
            discount = purchase.coupon_discount if purchase else Decimal(payment.metadata.get('coupon_discount', '0'))
            _, created = CouponUsage.objects.get_or_create(coupon=coupon, payment=payment, defaults={
                'user': payment.user, 'original_amount': payment.amount + discount,
                'discount_amount': discount, 'final_amount': payment.amount})
            if created:
                Coupon.objects.filter(pk=coupon.pk).update(usage_count=F('usage_count') + 1)

    _reward_referrer(payment)
    notify(payment.user, 'PAYMENT', 'Paiement confirmé',
           f'{payment.description} — {payment.amount:,.0f} {payment.currency}'.replace(',', ' '), '/')
    transaction.on_commit(lambda: _send_receipt(payment.pk))
    return payment


def _reward_referrer(payment):
    """Premier achat d'un filleul : le parrain reçoit un code promo personnel (une seule fois par filleul)."""
    from notifications.services import notify
    from users.models import User

    buyer = payment.user
    if not buyer.referred_by_id or buyer.referral_rewarded or payment.amount <= 0:
        return
    if payment.is_sandbox and not settings.PAYMENTS_ALLOW_SANDBOX:
        return
    updated = User.objects.filter(pk=buyer.pk, referral_rewarded=False).update(referral_rewarded=True)
    if not updated:  # déjà récompensé (webhooks concurrents)
        return
    referrer = buyer.referred_by
    import secrets
    now = timezone.now()
    coupon = Coupon.objects.create(
        code=f'PARRAIN-{secrets.token_hex(3).upper()}',
        description=f'Récompense de parrainage ({buyer.get_full_name()})',
        discount_type=Coupon.DiscountType.PERCENTAGE, discount_value=settings.REFERRAL_REWARD_PERCENT,
        usage_limit=1, per_user_limit=1, valid_from=now, valid_until=now + timedelta(days=180), reserved_for=referrer,
    )
    notify(referrer, 'PAYMENT', 'Parrainage récompensé 🎁',
           f'{buyer.first_name} a fait son premier achat : voici votre code -{settings.REFERRAL_REWARD_PERCENT} % : {coupon.code}',
           '/settings?tab=referral')


def _fulfill_course(payment):
    from courses.views import enroll_user

    purchase = payment.course_purchase
    course = purchase.course
    enroll_user(payment.user, course)
    _create_commission(payment, course.instructor)


def _create_commission(payment, instructor, amount=None):
    """Répartit (une part d') un paiement entre la plateforme et le formateur / vendeur. Idempotent."""
    amount = payment.amount if amount is None else Decimal(amount)
    rate = Decimal(str(settings.PLATFORM_COMMISSION_RATE))
    commission_amount = (amount * rate / 100).quantize(Decimal('0.01'))
    Commission.objects.get_or_create(payment=payment, instructor=instructor, defaults={
        'total_amount': amount, 'commission_rate': rate,
        'commission_amount': commission_amount, 'instructor_amount': amount - commission_amount,
    })
    instructor.refresh_instructor_stats()


def _fulfill_subscription(payment):
    meta = payment.metadata or {}
    months = int(meta.get('months', 1))
    now = timezone.now()
    current = Subscription.objects.active_for(payment.user).order_by('-end_date').first()
    if current and current.plan == meta.get('plan'):
        current.end_date = current.end_date + timedelta(days=30 * months)
        current.total_paid += payment.amount
        current.save(update_fields=['end_date', 'total_paid'])
        return current
    if current:  # changement de plan : l'ancien abonnement s'arrête
        current.status = Subscription.Status.CANCELLED
        current.save(update_fields=['status'])
    return Subscription.objects.create(
        user=payment.user, plan=meta.get('plan', 'BASIC'), status=Subscription.Status.ACTIVE, start_date=now,
        end_date=now + timedelta(days=30 * months), monthly_price=Decimal(meta.get('monthly_price', '0')),
        total_paid=payment.amount,
    )


def _send_receipt(payment_id):
    from users.emails import send_templated_email
    payment = Payment.objects.select_related('user').get(pk=payment_id)
    send_templated_email(f'Reçu de paiement {payment.reference}', 'emails/payment_receipt.html',
                         {'user': payment.user, 'payment': payment}, [payment.user.email])


@transaction.atomic
def refund_payment(payment, reason=''):
    """Rembourse (Stripe : automatiquement ; autres passerelles : remboursement manuel tracé)."""
    from courses.models import Enrollment

    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status != Payment.Status.COMPLETED:
        raise PaymentError('Seul un paiement réussi peut être remboursé.')
    if payment.gateway == 'STRIPE' and not payment.is_sandbox:
        try:
            get_gateway('STRIPE').refund(payment)
        except Exception as exc:
            raise PaymentError(f'Remboursement Stripe impossible : {exc}') from exc
    payment.status = Payment.Status.REFUNDED
    payment.metadata = {**(payment.metadata or {}), 'refund_reason': reason, 'refunded_at': timezone.now().isoformat()}
    payment.save(update_fields=['status', 'metadata'])

    purchase = getattr(payment, 'course_purchase', None)
    if purchase:
        Enrollment.objects.filter(user=payment.user, course=purchase.course).update(status=Enrollment.Status.CANCELLED)
        purchase.course.update_enrollment_stats()
        Commission.objects.filter(payment=payment).delete()
        purchase.course.instructor.refresh_instructor_stats()
    if payment.type == Payment.Type.SUBSCRIPTION:
        Subscription.objects.active_for(payment.user).update(status=Subscription.Status.CANCELLED)
    if payment.type == Payment.Type.PATH_PURCHASE:
        from courses.models import Enrollment
        from paths.models import LearningPath
        path = LearningPath.objects.filter(id=(payment.metadata or {}).get('path_id')).first()
        if path:
            for course in path.ordered_courses():
                Enrollment.objects.filter(user=payment.user, course=course).update(status=Enrollment.Status.CANCELLED)
                course.update_enrollment_stats()
    if payment.type == Payment.Type.COHORT_ENROLLMENT:
        from cohorts.models import CohortMembership
        CohortMembership.objects.filter(payment=payment).update(status=CohortMembership.Status.CANCELLED)
    if payment.type in (Payment.Type.PATH_PURCHASE, Payment.Type.COHORT_ENROLLMENT):
        for commission in Commission.objects.filter(payment=payment).select_related('instructor'):
            instructor = commission.instructor
            commission.delete()
            instructor.refresh_instructor_stats()
    if payment.type == Payment.Type.SESSION_BOOKING:
        from sessions_live.models import SessionRegistration
        SessionRegistration.objects.filter(payment=payment).update(status=SessionRegistration.Status.CANCELLED)
    if payment.type == Payment.Type.MARKETPLACE_ORDER:
        from marketplace.models import Order
        Order.objects.filter(payment=payment).update(status=Order.Status.REFUNDED)
    if payment.type in (Payment.Type.SESSION_BOOKING, Payment.Type.MARKETPLACE_ORDER):
        commission = Commission.objects.filter(payment=payment).select_related('instructor').first()
        if commission:
            instructor = commission.instructor
            commission.delete()
            instructor.refresh_instructor_stats()
    return payment
