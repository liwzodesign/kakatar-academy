from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PathsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'paths'
    verbose_name = _('Parcours')
