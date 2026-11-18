from django.db import transaction

from users.emails import send_templated_email
from notifications.services import notify

from .models import SessionRegistration


def send_confirmation(registration):
    session = registration.session
    notify(registration.user, 'SESSION', f'Inscription confirmée : {session.title}',
           session.start_at.strftime('Le %d/%m/%Y à %H:%M'), f'/sessions/{session.id}')
    send_templated_email(
        f'Inscription confirmée : {session.title}', 'emails/session_confirmation.html',
        {'user': registration.user, 'session': session}, [registration.user.email])


@transaction.atomic
def confirm_paid_registration(payment):
    """Appelé par payments.services.fulfill_payment pour une réservation payée."""
    registration = SessionRegistration.objects.select_related('session', 'user') \
        .filter(id=(payment.metadata or {}).get('registration_id')).first()
    if not registration or registration.status == SessionRegistration.Status.CONFIRMED:
        return registration
    registration.status = SessionRegistration.Status.CONFIRMED
    registration.payment = payment
    registration.save(update_fields=['status', 'payment'])
    transaction.on_commit(lambda: send_confirmation(registration))
    return registration
