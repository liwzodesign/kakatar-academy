import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def send_templated_email(subject, template, context, recipients):
    """Envoie un email HTML (+ version texte) sans jamais faire échouer la requête."""
    context = {'site_name': 'Kakatar Academy', 'frontend_url': settings.FRONTEND_URL, **context}
    try:
        html = render_to_string(template, context)
        send_mail(
            subject=subject,
            message=strip_tags(html),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=list(recipients),
            html_message=html,
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Échec d'envoi de l'email « %s »", subject)
        return False


def send_user_email(user, subject, template, context, transactional=False):
    """
    Email à un utilisateur. Les emails non transactionnels (annonces, rappels) respectent sa
    préférence « notifications par email » ; les transactionnels (reçus, sécurité) partent toujours.
    """
    if not transactional and not getattr(user, 'email_notifications', True):
        return False
    return send_templated_email(subject, template, {'user': user, **context}, [user.email])
