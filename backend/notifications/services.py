import logging

logger = logging.getLogger(__name__)


def notify(user, kind, title, message='', link=''):
    """Crée une notification in-app. Ne fait jamais échouer l'action métier qui l'appelle."""
    from .models import Notification

    try:
        return Notification.objects.create(user=user, kind=kind, title=title[:200], message=message[:500],
                                           link=link[:300])
    except Exception:  # pragma: no cover
        logger.exception('Notification impossible pour %s', getattr(user, 'pk', user))
        return None
