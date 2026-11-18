from celery import shared_task

from users.emails import send_user_email


@shared_task
def send_announcement_emails(announcement_id):
    """Envoie l'annonce par email aux inscrits (en arrière-plan ; respecte les préférences)."""
    from courses.models import Enrollment
    from .models import Announcement

    announcement = Announcement.objects.select_related('course').filter(id=announcement_id).first()
    if not announcement:
        return 0
    course = announcement.course
    link = f'/learn/{course.slug}?tab=announcements'
    sent = 0
    for enrollment in Enrollment.objects.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).select_related('user'):
        if send_user_email(enrollment.user, f'{course.title} — {announcement.title}', 'emails/announcement.html',
                           {'course': course, 'announcement': announcement, 'link': link}):
            sent += 1
    return sent
