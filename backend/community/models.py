import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from courses.models import Lesson
from users.models import User


class LessonComment(models.Model):
    """
    Question posée sous une leçon (parent vide) ou réponse à une question (parent = question).
    Un seul niveau de réponses pour garder des fils lisibles.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lesson_comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    body = models.TextField(_('message'), max_length=5000)
    is_resolved = models.BooleanField(_('résolue'), default=False)
    is_hidden = models.BooleanField(_('masqué par la modération'), default=False)
    likes = models.ManyToManyField(User, related_name='liked_lesson_comments', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('message de discussion')
        verbose_name_plural = _('messages de discussion')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['lesson', 'parent', '-created_at'])]

    def __str__(self):
        return f'{self.user} : {self.body[:50]}'

    @property
    def course(self):
        return self.lesson.module.course


class Announcement(models.Model):
    """Annonce d'un formateur à tous les inscrits d'un cours (notification + email selon préférences)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey('courses.Course', on_delete=models.CASCADE, related_name='announcements')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(_('titre'), max_length=200)
    body = models.TextField(_('message'), max_length=5000)
    recipients_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('annonce')
        verbose_name_plural = _('annonces')
        ordering = ['-created_at']

    def __str__(self):
        return self.title
