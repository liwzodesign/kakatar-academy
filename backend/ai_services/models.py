from django.db import models
from django.utils.translation import gettext_lazy as _

from users.models import User


class AIRequestLog(models.Model):
    """Journal d'utilisation des fonctionnalités IA (suivi des coûts et des abus)."""

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ai_requests')
    feature = models.CharField(max_length=30)
    success = models.BooleanField(default=True)
    used_llm = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('requête IA')
        verbose_name_plural = _('requêtes IA')
        ordering = ['-created_at']
