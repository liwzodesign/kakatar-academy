import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from users.models import User


class Notification(models.Model):
    """Notification affichée dans l'application (cloche du header)."""

    class Kind(models.TextChoices):
        PAYMENT = 'PAYMENT', _('Paiement')
        ENROLLMENT = 'ENROLLMENT', _('Inscription')
        COURSE = 'COURSE', _('Cours')
        CERTIFICATE = 'CERTIFICATE', _('Certificat')
        SESSION = 'SESSION', _('Session')
        ORDER = 'ORDER', _('Commande')
        REVIEW = 'REVIEW', _('Avis')
        COMMUNITY = 'COMMUNITY', _('Communauté')
        ACCOUNT = 'ACCOUNT', _('Compte')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500, blank=True)
    link = models.CharField(_('lien interne (frontend)'), max_length=300, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('notification')
        verbose_name_plural = _('notifications')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read', '-created_at'])]

    def __str__(self):
        return f'{self.user} — {self.title}'
