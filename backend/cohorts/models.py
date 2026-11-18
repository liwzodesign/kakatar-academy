import uuid

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from courses.models import Course
from users.models import User


class Cohort(models.Model):
    """Promotion d'un cours : un groupe qui avance ensemble entre deux dates, avec des sessions en direct."""

    class Status(models.TextChoices):
        OPEN = 'OPEN', _('Inscriptions ouvertes')
        CLOSED = 'CLOSED', _('Inscriptions fermées')
        CANCELLED = 'CANCELLED', _('Annulée')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='cohorts')
    title = models.CharField(_('nom de la promotion'), max_length=150)
    description = models.TextField(_('programme et rythme'), blank=True)
    start_date = models.DateField(_('début'))
    end_date = models.DateField(_('fin'))
    capacity = models.PositiveIntegerField(_('places'), default=30, validators=[MinValueValidator(1)])
    price = models.DecimalField(_('prix'), max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='XOF')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('cohorte')
        verbose_name_plural = _('cohortes')
        ordering = ['start_date']

    def __str__(self):
        return f'{self.course.title} — {self.title}'

    def members_count(self):
        return self.memberships.filter(status=CohortMembership.Status.CONFIRMED).count()

    def spots_left(self):
        return max(self.capacity - self.members_count(), 0)

    def is_open(self):
        return self.status == self.Status.OPEN and self.start_date >= timezone.localdate() and self.spots_left() > 0


class CohortMembership(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = 'PENDING_PAYMENT', _('En attente de paiement')
        CONFIRMED = 'CONFIRMED', _('Confirmée')
        CANCELLED = 'CANCELLED', _('Annulée')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cohort_memberships')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT)
    payment = models.ForeignKey('payments.Payment', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='cohort_memberships')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('membre de cohorte')
        verbose_name_plural = _('membres de cohorte')
        unique_together = ['cohort', 'user']
        ordering = ['-created_at']
