from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class SessionsLiveConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sessions_live'
    verbose_name = _('Sessions en direct')
