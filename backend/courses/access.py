"""Règles d'accès au contenu des cours."""
from .models import Enrollment

ACCESS_STATUSES = (Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)


def get_enrollment(user, course):
    if not user or not user.is_authenticated:
        return None
    return Enrollment.objects.filter(user=user, course=course, status__in=ACCESS_STATUSES).first()


def is_course_staff(user, course):
    if not user or not user.is_authenticated:
        return False
    return (
        user.is_superuser
        or getattr(user, 'role', None) == 'ADMIN'
        or course.instructor_id == user.id
        or course.co_instructors.filter(id=user.id).exists()
    )


def can_view_lesson(user, lesson, enrollment=None):
    """Aperçu gratuit, inscrit au cours, ou équipe pédagogique."""
    if lesson.is_free or lesson.module.is_free:
        return True
    course = lesson.module.course
    if is_course_staff(user, course):
        return True
    if enrollment is None:
        enrollment = get_enrollment(user, course)
    return enrollment is not None
