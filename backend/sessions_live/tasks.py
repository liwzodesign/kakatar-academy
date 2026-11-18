from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from users.emails import send_user_email
from notifications.services import notify

from .models import LiveSession, SessionRegistration


@shared_task
def send_session_reminders():
    """Rappels par email 24 h et 1 h avant chaque session ; clôture des sessions passées."""
    now = timezone.now()
    sent = 0
    windows = [
        ('reminder_24h_sent', timedelta(hours=23), timedelta(hours=24, minutes=15), 'demain'),
        ('reminder_1h_sent', timedelta(minutes=45), timedelta(hours=1, minutes=15), 'dans 1 heure'),
    ]
    for flag, low, high, when in windows:
        regs = SessionRegistration.objects.filter(
            status=SessionRegistration.Status.CONFIRMED, session__status=LiveSession.Status.SCHEDULED,
            session__start_at__gte=now + low, session__start_at__lte=now + high, **{flag: False},
        ).select_related('session', 'user')
        for reg in regs:
            send_user_email(reg.user, f'Rappel : {reg.session.title} commence {when}', 'emails/session_reminder.html',
                            {'session': reg.session, 'when': when})
            notify(reg.user, 'SESSION', f'{reg.session.title} commence {when}', '', f'/sessions/{reg.session.id}')
            setattr(reg, flag, True)
            reg.save(update_fields=[flag])
            sent += 1

    finished = 0
    for session in LiveSession.objects.filter(status__in=['SCHEDULED', 'LIVE'], start_at__lt=now - timedelta(hours=1)):
        if session.end_at < now:
            session.status = LiveSession.Status.COMPLETED
            session.save(update_fields=['status'])
            finished += 1
    return {'reminders_sent': sent, 'sessions_completed': finished}
