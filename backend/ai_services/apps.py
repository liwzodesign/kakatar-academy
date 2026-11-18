from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class AiServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_services'
    verbose_name = _('Services IA')
