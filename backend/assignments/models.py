import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from courses.models import Lesson
from users.models import User


class Submission(models.Model):
    """Travail rendu par un étudiant pour une leçon « Devoir » ou « Projet ». Un seul rendu par
    étudiant et par leçon : une nouvelle version remplace la précédente et repasse en correction."""

    class Status(models.TextChoices):
        SUBMITTED = 'SUBMITTED', _('À corriger')
        NEEDS_REVISION = 'NEEDS_REVISION', _('À reprendre')
        APPROVED = 'APPROVED', _('Validé')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')

    text = models.TextField(_('réponse'), blank=True, max_length=20000)
    link = models.URLField(_('lien (dépôt, maquette…)'), blank=True)
    file = models.FileField(_('fichier'), upload_to='assignments/', blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    grade = models.PositiveIntegerField(_('note /100'), null=True, blank=True,
                                        validators=[MinValueValidator(0), MaxValueValidator(100)])
    feedback = models.TextField(_('commentaire du formateur'), blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews_given')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('travail rendu')
        verbose_name_plural = _('travaux rendus')
        unique_together = ['lesson', 'user']
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.user} — {self.lesson} ({self.get_status_display()})'

    @property
    def course(self):
        return self.lesson.module.course
