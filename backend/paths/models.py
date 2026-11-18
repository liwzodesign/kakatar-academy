import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from courses.models import Course
from users.models import User


class LearningPath(models.Model):
    """Parcours : plusieurs cours à suivre dans un ordre conseillé, vendus ensemble à prix réduit."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PUBLISHED = 'PUBLISHED', _('Publié')
        ARCHIVED = 'ARCHIVED', _('Archivé')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_('titre'), max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    subtitle = models.CharField(_('sous-titre'), max_length=300, blank=True)
    description = models.TextField(_('description'))
    thumbnail_url = models.URLField(_('image'), blank=True)
    level = models.CharField(max_length=20, choices=Course.Level.choices, default=Course.Level.DEBUTANT)
    price = models.DecimalField(_('prix du parcours'), max_digits=10, decimal_places=2, default=0,
                                validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='XOF')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='learning_paths')
    courses = models.ManyToManyField(Course, through='PathCourse', related_name='paths')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('parcours')
        verbose_name_plural = _('parcours')
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or 'parcours'
            slug, i = base, 1
            while LearningPath.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f'{base}-{i}'
            self.slug = slug
        super().save(*args, **kwargs)

    def ordered_courses(self):
        return [pc.course for pc in self.path_courses.select_related('course__instructor', 'course__category')]

    def total_value(self):
        """Prix cumulé des cours achetés séparément."""
        return sum((c.price for c in self.courses.all()), Decimal('0'))

    def savings(self):
        return max(self.total_value() - self.price, Decimal('0'))


class PathCourse(models.Model):
    path = models.ForeignKey(LearningPath, on_delete=models.CASCADE, related_name='path_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='path_links')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = ['path', 'course']
