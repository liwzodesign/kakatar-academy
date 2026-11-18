from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Payment, Subscription


@shared_task
def expire_subscriptions():
    """Passe en EXPIRED les abonnements échus et annule les paiements abandonnés."""
    now = timezone.now()
    expired = Subscription.objects.filter(status=Subscription.Status.ACTIVE, end_date__lt=now) \
        .update(status=Subscription.Status.EXPIRED)
    abandoned = Payment.objects.filter(status=Payment.Status.PENDING, created_at__lt=now - timedelta(hours=24)) \
        .update(status=Payment.Status.CANCELLED, error_message='Paiement abandonné (24 h)')
    return {'expired_subscriptions': expired, 'abandoned_payments': abandoned}
