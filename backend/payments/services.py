"""Logique métier des paiements : création, finalisation idempotente."""
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from courses.models import Course, Enrollment

from .gateways import GatewayError, get_gateway
from .models import Commission, Coupon, CouponUsage, CoursePurchase, Payment

logger = logging.getLogger(__name__)
DEFAULT_COMMISSION_RATE = Decimal('15.00')


class CheckoutError(Exception):
    pass


def compute_price(course: Course, user, coupon_code: str = ''):
    """Retourne (prix_final, coupon|None, remise)."""
    price = Decimal(course.price)
    coupon, discount = None, Decimal('0')
    if coupon_code:
        coupon = Coupon.objects.filter(code__iexact=coupon_code.strip()).first()
        if not coupon or not coupon.is_valid() or not coupon.can_use_for_user(user):
            raise CheckoutError('Code promo invalide ou expiré.')
        applicable = coupon.applicable_courses.all()
        cats = coupon.applicable_categories.all()
        if (applicable.exists() and course not in applicable) or (cats.exists() and course.category not in cats):
            raise CheckoutError("Ce code promo ne s'applique pas à ce cours.")
        if price < coupon.minimum_amount:
            raise CheckoutError('Montant minimum non atteint pour ce code promo.')
        discount = min(Decimal(coupon.calculate_discount(price)), price)
    return (price - discount).quantize(Decimal('1')), coupon, discount


def start_checkout(*, user, course: Course, gateway_name: str, coupon_code: str = '') -> Payment:
    if not course.is_published() or course.is_free():
        raise CheckoutError("Ce cours n'est pas disponible à l'achat.")
    if Enrollment.objects.filter(user=user, course=course, status__in=['ACTIVE', 'COMPLETED']).exists():
        raise CheckoutError('Vous avez déjà accès à ce cours.')
    if not course.can_enroll():
        raise CheckoutError('Ce cours est complet.')

    final_price, coupon, discount = compute_price(course, user, coupon_code)

    payment = Payment.objects.create(
        user=user, amount=final_price, currency=course.currency, gateway=gateway_name,
        type=Payment.Type.COURSE_PURCHASE, description=f'Achat du cours « {course.title} »',
        metadata={'course_id': str(course.id), 'coupon': coupon.code if coupon else ''},
    )
    CoursePurchase.objects.create(
        payment=payment, course=course, original_price=course.price, final_price=final_price,
        coupon_code=coupon.code if coupon else '', coupon_discount=discount,
    )

    # Coupon à 100 % : pas besoin de passerelle
    if final_price <= 0:
        mark_completed(payment, {'free_with_coupon': True})
        return payment

    gateway = get_gateway(gateway_name)
    if not gateway.configured:
        payment.status = Payment.Status.FAILED
        payment.error_message = f'{gateway_name} non configuré'
        payment.save(update_fields=['status', 'error_message'])
        raise CheckoutError('Ce moyen de paiement est momentanément indisponible.')

    front = settings.FRONTEND_URL.rstrip('/')
    back = settings.BACKEND_URL.rstrip('/')
    return_url = f'{front}/paiement/retour?payment={payment.id}'
    try:
        if gateway_name == 'WAVE':
            result = gateway.create_checkout(
                amount=final_price, currency=course.currency, client_reference=str(payment.id),
                success_url=return_url, error_url=f'{return_url}&erreur=1',
            )
        else:
            result = gateway.create_checkout(
                amount=final_price, currency=course.currency, client_reference=str(payment.id),
                description=payment.description, return_url=return_url,
                cancel_url=f'{return_url}&erreur=1',
                callback_url=f'{back}/api/v1/payments/webhooks/paydunya/',
            )
    except GatewayError as exc:
        payment.status = Payment.Status.FAILED
        payment.error_message = str(exc)
        payment.save(update_fields=['status', 'error_message'])
        raise CheckoutError(str(exc)) from exc

    payment.gateway_transaction_id = result.reference
    payment.checkout_url = result.checkout_url
    payment.gateway_response = result.raw
    payment.status = Payment.Status.PROCESSING
    payment.save(update_fields=['gateway_transaction_id', 'checkout_url', 'gateway_response', 'status'])
    return payment


def mark_completed(payment: Payment, gateway_data: dict | None = None) -> Payment:
    """Finalise un paiement et ouvre l'accès au cours. Idempotent."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status == Payment.Status.COMPLETED:
            return payment
        payment.status = Payment.Status.COMPLETED
        payment.completed_at = timezone.now()
        if gateway_data:
            payment.gateway_response = gateway_data
        payment.save(update_fields=['status', 'completed_at', 'gateway_response'])

        purchase = getattr(payment, 'course_purchase', None)
        if purchase:
            course = purchase.course
            enrollment, created = Enrollment.objects.get_or_create(user=payment.user, course=course)
            if not created and enrollment.status in ('CANCELLED', 'EXPIRED'):
                enrollment.status = Enrollment.Status.ACTIVE
                enrollment.save(update_fields=['status'])
            course.update_students_count()

            if purchase.coupon_code:
                coupon = Coupon.objects.filter(code__iexact=purchase.coupon_code).first()
                if coupon:
                    CouponUsage.objects.create(
                        coupon=coupon, user=payment.user, payment=payment,
                        original_amount=purchase.original_price, discount_amount=purchase.coupon_discount,
                        final_amount=purchase.final_price)
                    coupon.usage_count += 1
                    coupon.save(update_fields=['usage_count'])

            if payment.amount > 0 and not Commission.objects.filter(payment=payment).exists():
                commission = Commission(payment=payment, instructor=course.instructor,
                                        total_amount=payment.amount, commission_rate=DEFAULT_COMMISSION_RATE)
                commission.calculate_commission()
                commission.save()
    return payment


def mark_failed(payment: Payment, gateway_data: dict | None = None, reason: str = '') -> Payment:
    if payment.status in (Payment.Status.COMPLETED, Payment.Status.FAILED):
        return payment
    payment.status = Payment.Status.FAILED
    payment.error_message = reason
    if gateway_data:
        payment.gateway_response = gateway_data
    payment.save(update_fields=['status', 'error_message', 'gateway_response'])
    return payment


def sync_with_gateway(payment: Payment) -> Payment:
    """Relit l'état réel auprès de la passerelle et met à jour le paiement."""
    if payment.status in (Payment.Status.COMPLETED, Payment.Status.FAILED) or not payment.gateway_transaction_id:
        return payment
    gateway = get_gateway(payment.gateway)
    state, data = gateway.fetch_status(payment.gateway_transaction_id)
    if state == 'completed':
        expected = Decimal(payment.amount).quantize(Decimal('1'))
        paid = data.get('amount') or (data.get('invoice') or {}).get('total_amount')
        if paid is not None and Decimal(str(paid)).quantize(Decimal('1')) != expected:
            logger.error('Montant incohérent pour %s : attendu %s, reçu %s', payment.id, expected, paid)
            return mark_failed(payment, data, 'Montant payé incohérent')
        return mark_completed(payment, data)
    if state == 'failed':
        return mark_failed(payment, data, 'Paiement annulé ou expiré')
    return payment
