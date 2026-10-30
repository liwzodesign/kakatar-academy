from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Lesson


@receiver([post_save, post_delete], sender=Lesson)
def refresh_course_stats(sender, instance, **kwargs):
    """Garde durée et nombre de leçons du cours à jour."""
    try:
        instance.module.course.update_stats()
    except Exception:
        pass
