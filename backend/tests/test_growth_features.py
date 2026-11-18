from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from courses.models import CourseReview, Lesson
from notifications.models import Notification
from payments.models import Commission, Coupon, PayoutRequest
from sessions_live.models import LiveSession
from users.models import User

from .conftest import PASSWORD, make_user


def _buy(client, slug):
    pid = client.post('/api/v1/payments/checkout/', {'gateway': 'WAVE', 'course_slug': slug}, format='json').data['payment']['id']
    client.post(f'/api/v1/payments/{pid}/sandbox-confirm/', format='json')
    return pid


# ---------------------------------------------------------------- Versements
def test_payout_request_cycle(auth, student, instructor, admin_user, paid_course, settings):
    settings.PAYOUT_MINIMUM = 10000
    teacher = auth(instructor)
    assert teacher.get('/api/v1/payments/payouts/').data['available'] == 0
    bad = {'method': 'WAVE', 'account': '+221770000000', 'account_name': 'Formateur Test'}
    assert teacher.post('/api/v1/payments/payouts/', bad, format='json').status_code == 400  # solde insuffisant

    _buy(auth(student), paid_course.slug)  # 50 000 → 42 500 pour le formateur
    teacher = auth(instructor)
    assert Decimal(str(teacher.get('/api/v1/payments/payouts/').data['available'])) == Decimal('42500')
    assert teacher.post('/api/v1/payments/payouts/', {'method': 'WAVE', 'account': '12', 'account_name': 'X'},
                        format='json').status_code == 400  # numéro trop court
    resp = teacher.post('/api/v1/payments/payouts/', bad, format='json')
    assert resp.status_code == 201 and Decimal(str(resp.data['amount'])) == Decimal('42500')
    assert teacher.post('/api/v1/payments/payouts/', bad, format='json').status_code == 400  # déjà une demande en cours
    assert Decimal(str(teacher.get('/api/v1/payments/payouts/').data['available'])) == 0  # solde réservé
    assert Notification.objects.filter(user=admin_user, kind='PAYMENT').exists()

    # Refus : le solde redevient disponible
    payout_id = resp.data['id']
    admin = auth(admin_user)
    assert admin.post(f'/api/v1/payments/admin/payout-requests/{payout_id}/', {'action': 'reject'}, format='json').status_code == 400
    admin.post(f'/api/v1/payments/admin/payout-requests/{payout_id}/', {'action': 'reject', 'admin_note': 'Numéro invalide'}, format='json')
    assert Decimal(str(auth(instructor).get('/api/v1/payments/payouts/').data['available'])) == Decimal('42500')

    # Nouvelle demande puis versement : les commissions passent « versées »
    payout_id = auth(instructor).post('/api/v1/payments/payouts/', bad, format='json').data['id']
    resp = auth(admin_user).post(f'/api/v1/payments/admin/payout-requests/{payout_id}/',
                                 {'action': 'paid', 'transaction_reference': 'WAVE-123'}, format='json')
    assert resp.data['status'] == 'PAID'
    assert Commission.objects.filter(instructor=instructor, is_paid=True).count() == 1
    assert auth(student).get('/api/v1/payments/admin/payout-requests/').status_code == 403


def test_sandbox_sales_never_paid_out_in_production(auth, student, instructor, paid_course, settings):
    _buy(auth(student), paid_course.slug)
    settings.PAYMENTS_ALLOW_SANDBOX = False
    assert auth(instructor).get('/api/v1/payments/payouts/').data['available'] == 0


# ---------------------------------------------------------------- Parrainage
def test_referral_rewards_referrer_once(api, auth, student, paid_course, free_course, instructor):
    code = auth(student).get('/api/v1/auth/referral/').data['code']
    assert len(code) == 7
    api.force_authenticate(None)
    resp = api.post('/api/v1/auth/register/', {
        'email': 'filleul@test.com', 'first_name': 'Awa', 'last_name': 'Ndiaye', 'password': PASSWORD,
        'password_confirm': PASSWORD, 'referral_code': code.lower()}, format='json')
    assert resp.status_code == 201
    filleul = User.objects.get(email='filleul@test.com')
    assert filleul.referred_by == student

    _buy(auth(filleul), paid_course.slug)
    reward = Coupon.objects.get(reserved_for=student)
    assert reward.discount_value == 20 and reward.usage_limit == 1
    overview = auth(student).get('/api/v1/auth/referral/').data
    assert overview['referred_count'] == 1 and overview['converted_count'] == 1 and len(overview['rewards']) == 1

    # Deuxième achat du filleul : pas de nouvelle récompense
    other = build_paid_course(instructor, paid_course.category, 'Autre cours payant')
    _buy(auth(filleul), other.slug)
    assert Coupon.objects.filter(reserved_for=student).count() == 1

    # Le code est personnel : le filleul ne peut pas l'utiliser
    resp = auth(filleul).post('/api/v1/payments/coupons/validate/', {'code': reward.code, 'course_slug': paid_course.slug}, format='json')
    assert resp.status_code == 400


def test_unknown_referral_code_does_not_block_signup(api, db):
    resp = api.post('/api/v1/auth/register/', {
        'email': 'x@test.com', 'first_name': 'X', 'last_name': 'Y', 'password': PASSWORD, 'password_confirm': PASSWORD,
        'referral_code': 'INCONNU'}, format='json')
    assert resp.status_code == 201 and User.objects.get(email='x@test.com').referred_by is None


def build_paid_course(instructor, category, title):
    from .conftest import build_course
    return build_course(instructor, category, price=30000, title=title)


# ---------------------------------------------------------------- Badges et XP
def test_achievements_progress(auth, student, free_course):
    client = auth(student)
    data = client.get('/api/v1/analytics/achievements/').data
    assert data['xp'] == 0 and data['level'] == 1 and data['unlocked_count'] == 0
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    for lesson in Lesson.objects.filter(module__course=free_course):
        client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/')
    data = client.get('/api/v1/analytics/achievements/').data
    unlocked = {b['key'] for b in data['badges'] if b['unlocked']}
    assert {'first_step', 'first_lesson', 'graduate'} <= unlocked
    assert data['xp'] == 4 * 10 + 100  # 4 leçons + 1 certificat
    assert data['level'] == 2


# ---------------------------------------------------------------- Agenda
def test_session_ics_export(api, instructor):
    session = LiveSession.objects.create(
        title='Atelier ; virgules, et accents é', description='Ligne 1\nLigne 2', instructor=instructor, type='ONLINE',
        start_at=timezone.now() + timedelta(days=2), duration=90, capacity=10)
    resp = api.get(f'/api/v1/sessions/{session.id}/calendar.ics')
    body = resp.content.decode('utf-8')
    assert resp.status_code == 200 and resp['Content-Type'].startswith('text/calendar')
    assert body.startswith('BEGIN:VCALENDAR\r\n') and body.endswith('END:VCALENDAR\r\n')
    assert 'SUMMARY:Atelier \\; virgules\\, et accents é' in body
    assert 'Ligne 1\\nLigne 2' in body
    assert session.meeting_url not in body  # le lien de visio reste privé
    assert all(len(line.encode()) <= 75 for line in body.split('\r\n'))


# ---------------------------------------------------------------- Réponse aux avis
def test_instructor_replies_to_review(auth, student, instructor, free_course):
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    review_id = client.post(f'/api/v1/courses/{free_course.slug}/reviews/create/', {'rating': 3, 'comment': 'Bien mais court'},
                            format='json').data['id']
    url = f'/api/v1/courses/reviews/{review_id}/reply/'
    assert client.post(url, {'reply': 'Je réponds à ma place'}, format='json').status_code == 403
    resp = auth(instructor).post(url, {'reply': 'Merci ! Un module bonus arrive.'}, format='json')
    assert resp.data['instructor_reply'] == 'Merci ! Un module bonus arrive.' and resp.data['replied_at']
    assert Notification.objects.filter(user=student, kind='REVIEW').exists()
    free_course.refresh_from_db()
    assert float(free_course.rating_average) == 3  # la note n'est pas modifiée
    listed = auth(student).get(f'/api/v1/courses/{free_course.slug}/').data['reviews'][0]
    assert listed['instructor_reply'].startswith('Merci')
    assert CourseReview.objects.get(id=review_id).replied_at is not None
