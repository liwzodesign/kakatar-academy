from django.db import models
from django.utils.translation import gettext_lazy as _


class DailySnapshot(models.Model):
    """Indicateurs de la plateforme figés chaque jour (historique des KPI)."""

    date = models.DateField(unique=True)
    total_users = models.PositiveIntegerField(default=0)
    new_users = models.PositiveIntegerField(default=0)
    active_users = models.PositiveIntegerField(default=0)
    total_courses = models.PositiveIntegerField(default=0)
    new_enrollments = models.PositiveIntegerField(default=0)
    completions = models.PositiveIntegerField(default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    platform_commission = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('instantané quotidien')
        verbose_name_plural = _('instantanés quotidiens')
        ordering = ['-date']

    def __str__(self):
        return f'Snapshot {self.date}'


class DailyActivity(models.Model):
    """Activité d'apprentissage d'un utilisateur pour une journée (objectif quotidien, rappels)."""

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='daily_activity')
    date = models.DateField()
    minutes = models.PositiveIntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    reminded = models.BooleanField(default=False)

    class Meta:
        verbose_name = _('activité quotidienne')
        verbose_name_plural = _('activités quotidiennes')
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f'{self.user} — {self.date} : {self.minutes} min'

    @classmethod
    def record_lesson(cls, user, minutes):
        from django.db.models import F
        from django.utils import timezone
        activity, _ = cls.objects.get_or_create(user=user, date=timezone.localdate())
        cls.objects.filter(pk=activity.pk).update(minutes=F('minutes') + minutes,
                                                  lessons_completed=F('lessons_completed') + 1)


class ReviewCard(models.Model):
    """Question de quiz à réviser (répétition espacée, système de Leitner à 5 boîtes)."""

    INTERVALS = {1: 1, 2: 3, 3: 7, 4: 16, 5: 35}  # jours avant la prochaine révision, selon la boîte

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='review_cards')
    lesson = models.ForeignKey('courses.Lesson', on_delete=models.CASCADE, related_name='review_cards')
    question_index = models.PositiveSmallIntegerField()
    box = models.PositiveSmallIntegerField(default=1)
    due = models.DateField()
    lapses = models.PositiveIntegerField(default=0)
    reviews = models.PositiveIntegerField(default=0)
    mastered = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('carte de révision')
        verbose_name_plural = _('cartes de révision')
        unique_together = ['user', 'lesson', 'question_index']
        indexes = [models.Index(fields=['user', 'mastered', 'due'])]

    def __str__(self):
        return f'{self.user} — {self.lesson} Q{self.question_index + 1} (boîte {self.box})'
