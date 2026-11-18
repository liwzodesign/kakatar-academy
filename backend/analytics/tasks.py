from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone

from courses.models import Course, Enrollment
from payments.models import Commission, Payment

from .models import DailySnapshot


@shared_task
def compute_daily_snapshot(date=None):
    """Fige les KPI de la veille (ou de `date`, format AAAA-MM-JJ)."""
    User = get_user_model()
    day = timezone.datetime.fromisoformat(date).date() if date else timezone.localdate() - timedelta(days=1)
    start = timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time()))
    end = start + timedelta(days=1)
    payments = Payment.objects.filter(status='COMPLETED', is_sandbox=False, completed_at__gte=start,
                                      completed_at__lt=end)
    snapshot, _ = DailySnapshot.objects.update_or_create(date=day, defaults={
        'total_users': User.objects.filter(date_joined__lt=end).count(),
        'new_users': User.objects.filter(date_joined__gte=start, date_joined__lt=end).count(),
        'active_users': User.objects.filter(last_activity__gte=start, last_activity__lt=end).count(),
        'total_courses': Course.objects.filter(status='PUBLISHED').count(),
        'new_enrollments': Enrollment.objects.filter(enrolled_at__gte=start, enrolled_at__lt=end).count(),
        'completions': Enrollment.objects.filter(completed_at__gte=start, completed_at__lt=end).count(),
        'revenue': payments.aggregate(s=Sum('amount'))['s'] or 0,
        'platform_commission': Commission.objects.filter(payment__in=payments)
        .aggregate(s=Sum('commission_amount'))['s'] or 0,
    })
    return str(snapshot)


@shared_task
def send_daily_reminders():
    """
    Toutes les heures : rappelle aux apprenants actifs (14 derniers jours) dont c'est l'heure de rappel,
    dans leur fuseau horaire, que leur objectif du jour n'est pas atteint. Un rappel par jour maximum.
    """
    from zoneinfo import ZoneInfo
    from notifications.services import notify
    from users.emails import send_user_email
    from users.models import UserProfile
    from .models import DailyActivity

    now = timezone.now()
    sent = 0
    profiles = UserProfile.objects.filter(reminder_enabled=True, user__is_active=True, user__is_banned=False,
                                          user__last_activity__gte=now - timedelta(days=14)).select_related('user')
    for profile in profiles:
        user = profile.user
        try:
            local = now.astimezone(ZoneInfo(user.timezone or 'Africa/Abidjan'))
        except Exception:
            local = timezone.localtime(now)
        if local.hour != profile.reminder_hour:
            continue
        activity, _ = DailyActivity.objects.get_or_create(user=user, date=local.date())
        if activity.reminded or activity.minutes >= profile.daily_goal_minutes:
            continue
        remaining = profile.daily_goal_minutes - activity.minutes
        streak = f' et garder votre série de {profile.current_streak} jours' if profile.current_streak > 1 else ''
        message = f'Encore {remaining} min pour atteindre votre objectif du jour{streak}.'
        notify(user, 'COURSE', "C'est l'heure d'apprendre 📚", message, '/my-courses')
        send_user_email(user, 'Votre objectif du jour vous attend', 'emails/daily_reminder.html', {'message': message})
        activity.reminded = True
        activity.save(update_fields=['reminded'])
        sent += 1
    return sent
