from django.db import transaction
from django.utils import timezone

from notifications.services import notify

from .models import CohortMembership


def register_member_to_sessions(membership):
    """Inscrit un membre à toutes les sessions à venir de sa cohorte."""
    from sessions_live.models import LiveSession, SessionRegistration

    sessions = LiveSession.objects.filter(cohort=membership.cohort, start_at__gte=timezone.now()) \
        .exclude(status=LiveSession.Status.CANCELLED)
    for session in sessions:
        SessionRegistration.objects.update_or_create(
            session=session, user=membership.user, defaults={'status': SessionRegistration.Status.CONFIRMED})


def register_cohort_to_session(session):
    """Nouvelle session de cohorte : tous les membres confirmés y sont inscrits et prévenus."""
    from sessions_live.models import SessionRegistration

    if not session.cohort_id:
        return 0
    members = CohortMembership.objects.filter(cohort_id=session.cohort_id, status=CohortMembership.Status.CONFIRMED) \
        .select_related('user')
    for m in members:
        SessionRegistration.objects.update_or_create(session=session, user=m.user,
                                                     defaults={'status': SessionRegistration.Status.CONFIRMED})
        notify(m.user, 'SESSION', f'Nouvelle session de votre promotion : {session.title}',
               session.start_at.strftime('Le %d/%m/%Y à %H:%M'), f'/sessions/{session.id}')
    return members.count()


@transaction.atomic
def confirm_membership(membership, payment=None):
    """Confirme l'adhésion : inscription au cours, aux sessions de la cohorte, notification."""
    from courses.views import enroll_user

    if membership.status == CohortMembership.Status.CONFIRMED:
        return membership
    membership.status = CohortMembership.Status.CONFIRMED
    if payment:
        membership.payment = payment
    membership.save(update_fields=['status', 'payment'])
    enroll_user(membership.user, membership.cohort.course)
    register_member_to_sessions(membership)
    cohort = membership.cohort
    notify(membership.user, 'ENROLLMENT', f'Bienvenue dans la promotion « {cohort.title} »',
           f"Début le {cohort.start_date.strftime('%d/%m/%Y')}", f'/courses/{cohort.course.slug}')
    return membership


def confirm_paid_membership(payment):
    """Appelé par payments.services.fulfill_payment."""
    membership = CohortMembership.objects.select_related('cohort__course', 'user') \
        .filter(id=(payment.metadata or {}).get('membership_id')).first()
    if not membership:
        return None
    return confirm_membership(membership, payment)
