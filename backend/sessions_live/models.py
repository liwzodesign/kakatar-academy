import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from courses.models import Category, Course
from users.models import User


class LiveSession(models.Model):
    """Session de formation en direct (en ligne, présentiel ou hybride)."""

    class Type(models.TextChoices):
        ONLINE = 'ONLINE', _('En ligne')
        PRESENTIAL = 'PRESENTIAL', _('Présentiel')
        HYBRID = 'HYBRID', _('Hybride')

    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', _('Programmée')
        LIVE = 'LIVE', _('En cours')
        COMPLETED = 'COMPLETED', _('Terminée')
        CANCELLED = 'CANCELLED', _('Annulée')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_('titre'), max_length=200)
    description = models.TextField(_('description'))
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='live_sessions')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_sessions',
                               help_text=_('Cours associé (facultatif)'))
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='live_sessions')
    cohort = models.ForeignKey('cohorts.Cohort', on_delete=models.CASCADE, null=True, blank=True,
                               related_name='live_sessions', help_text=_('Session réservée aux membres de la promotion'))
    level = models.CharField(max_length=20, choices=Course.Level.choices, default=Course.Level.DEBUTANT)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.ONLINE)

    start_at = models.DateTimeField(_('début'))
    duration = models.PositiveIntegerField(_('durée (minutes)'), default=60, validators=[MinValueValidator(15)])
    location = models.CharField(_('lieu'), max_length=255, blank=True,
                                help_text=_('Adresse pour le présentiel'))
    meeting_url = models.URLField(_('lien de visioconférence'), blank=True,
                                  help_text=_('Laisser vide pour générer une salle Jitsi automatiquement'))
    recording_url = models.URLField(_("lien de l'enregistrement"), blank=True)

    capacity = models.PositiveIntegerField(_('places'), default=20, validators=[MinValueValidator(1)])
    price = models.DecimalField(_('prix'), max_digits=10, decimal_places=2, default=0,
                                validators=[MinValueValidator(0)])
    currency = models.CharField(_('devise'), max_length=3, default='XOF')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('session en direct')
        verbose_name_plural = _('sessions en direct')
        ordering = ['start_at']
        indexes = [models.Index(fields=['status', 'start_at'])]

    def __str__(self):
        return f"{self.title} ({self.start_at:%d/%m/%Y %H:%M})"

    def save(self, *args, **kwargs):
        if self.type != self.Type.PRESENTIAL and not self.meeting_url:
            room = f"KakatarAcademy-{secrets.token_urlsafe(10)}"
            self.meeting_url = f"{settings.LIVE_MEETING_BASE_URL.rstrip('/')}/{room}"
        super().save(*args, **kwargs)

    @property
    def end_at(self):
        return self.start_at + timedelta(minutes=self.duration)

    def confirmed_count(self):
        return self.registrations.filter(status__in=[SessionRegistration.Status.CONFIRMED,
                                                     SessionRegistration.Status.ATTENDED]).count()

    def spots_left(self):
        return max(self.capacity - self.confirmed_count(), 0)

    def is_open_for_registration(self):
        return self.status == self.Status.SCHEDULED and self.start_at > timezone.now() and self.spots_left() > 0

    def can_join_now(self):
        now = timezone.now()
        return self.status != self.Status.CANCELLED and self.start_at - timedelta(minutes=15) <= now <= self.end_at


class SessionRegistration(models.Model):
    """Inscription d'un participant à une session."""

    class Status(models.TextChoices):
        PENDING_PAYMENT = 'PENDING_PAYMENT', _('En attente de paiement')
        CONFIRMED = 'CONFIRMED', _('Confirmée')
        CANCELLED = 'CANCELLED', _('Annulée')
        ATTENDED = 'ATTENDED', _('Présent')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name='registrations')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_registrations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT)
    payment = models.ForeignKey('payments.Payment', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='session_registrations')

    # Informations saisies lors de la réservation
    phone = models.CharField(_('téléphone'), max_length=30, blank=True)
    company = models.CharField(_('entreprise'), max_length=200, blank=True)
    experience = models.CharField(_('niveau d\'expérience'), max_length=50, blank=True)
    expectations = models.TextField(_('attentes'), blank=True)

    reminder_24h_sent = models.BooleanField(default=False)
    reminder_1h_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('inscription à une session')
        verbose_name_plural = _('inscriptions aux sessions')
        unique_together = ['session', 'user']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} → {self.session} ({self.get_status_display()})"
