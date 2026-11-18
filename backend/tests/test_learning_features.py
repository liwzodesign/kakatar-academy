from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from analytics.models import DailyActivity
from cohorts.models import Cohort, CohortMembership
from courses.media import SALT, make_token
from courses.models import Enrollment, Lesson
from notifications.models import Notification
from payments.models import Commission, Coupon
from sessions_live.models import LiveSession, SessionRegistration

from .conftest import build_course, make_user


def _buy(client, payload):
    resp = client.post('/api/v1/payments/checkout/', {'gateway': 'WAVE', **payload}, format='json')
    return resp


def _confirm(client, payment_id):
    return client.post(f'/api/v1/payments/{payment_id}/sandbox-confirm/', format='json')


# ------------------------------------------------------------ Codes promo des formateurs
def test_instructor_coupon_limited_to_own_courses(auth, instructor, student, paid_course, category):
    other_teacher = make_user('autre@test.com', role='FORMATEUR', verification_status='VERIFIED')
    foreign_course = build_course(other_teacher, category, price=40000, title='Cours d’un autre')
    now = timezone.now()
    base = {'code': 'jean10', 'discount_type': 'PERCENTAGE', 'discount_value': '10',
            'valid_from': now.isoformat(), 'valid_until': (now + timedelta(days=10)).isoformat()}
    teacher = auth(instructor)
    url = '/api/v1/payments/instructor/coupons/'
    assert teacher.post(url, base, format='json').status_code == 400  # aucun cours ciblé
    assert teacher.post(url, {**base, 'applicable_courses': [str(foreign_course.id)]}, format='json').status_code == 400
    assert teacher.post(url, {**base, 'discount_value': '95', 'applicable_courses': [str(paid_course.id)]},
                        format='json').status_code == 400
    resp = teacher.post(url, {**base, 'applicable_courses': [str(paid_course.id)]}, format='json')
    assert resp.status_code == 201 and resp.data['code'] == 'JEAN10'
    assert Coupon.objects.get(code='JEAN10').created_by == instructor

    buyer = auth(student)
    ok = buyer.post('/api/v1/payments/coupons/validate/', {'code': 'JEAN10', 'course_slug': paid_course.slug}, format='json')
    assert ok.status_code == 200 and Decimal(str(ok.data['final_amount'])) == Decimal('45000')
    ko = buyer.post('/api/v1/payments/coupons/validate/', {'code': 'JEAN10', 'course_slug': foreign_course.slug}, format='json')
    assert ko.status_code == 400
    # Chacun ne voit que ses codes ; l'étudiant n'a pas accès
    assert auth(other_teacher).get(url).data == []
    assert auth(student).get(url).status_code == 403


# ------------------------------------------------------------ Objectif quotidien
def test_daily_goal_tracks_today_and_validates(auth, student, free_course):
    client = auth(student)
    assert client.get('/api/v1/analytics/daily-goal/').data['today_minutes'] == 0
    assert client.patch('/api/v1/analytics/daily-goal/', {'daily_goal_minutes': 7}, format='json').status_code == 400
    assert client.patch('/api/v1/analytics/daily-goal/', {'reminder_hour': 3}, format='json').status_code == 400
    client.patch('/api/v1/analytics/daily-goal/', {'daily_goal_minutes': 15, 'reminder_hour': 20}, format='json')
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    lesson = Lesson.objects.filter(module__course=free_course).first()
    client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/')
    data = client.get('/api/v1/analytics/daily-goal/').data
    assert data['today_minutes'] == 10 and data['today_lessons'] == 1 and data['reached'] is False
    assert data['reminder_hour'] == 20 and len(data['last_7_days']) == 7
    # Refaire la même leçon ne compte pas deux fois
    client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/')
    assert client.get('/api/v1/analytics/daily-goal/').data['today_minutes'] == 10


def test_daily_reminder_sent_once_at_user_hour(student):
    from analytics.tasks import send_daily_reminders
    profile = student.profile
    student.last_activity = timezone.now()
    student.save(update_fields=['last_activity'])
    local_hour = timezone.localtime().hour
    profile.reminder_hour = (local_hour + 1) % 24
    profile.save()
    assert send_daily_reminders() == 0  # pas encore l'heure
    profile.reminder_hour = local_hour
    profile.save()
    assert send_daily_reminders() == 1
    assert send_daily_reminders() == 0  # un seul rappel par jour
    assert Notification.objects.filter(user=student, title__startswith="C'est l'heure").count() == 1
    # Objectif atteint : pas de rappel
    DailyActivity.objects.filter(user=student).update(reminded=False, minutes=60)
    assert send_daily_reminders() == 0


# ------------------------------------------------------------ Vidéos protégées et hors connexion
def _video_lesson(course):
    lesson = Lesson.objects.filter(module__course=course).order_by('module__order', 'order').last()
    lesson.type = 'VIDEO'
    lesson.video_file = SimpleUploadedFile('cours.mp4', b'FAKE-MP4-DATA', content_type='video/mp4')
    lesson.video_status = 'READY'
    lesson.save()
    return lesson


def test_hosted_video_requires_signed_token(api, auth, student, paid_course):
    lesson = _video_lesson(paid_course)
    # Non inscrit : aucune URL de lecture fournie
    detail = auth(student).get(f'/api/v1/courses/{paid_course.slug}/').data
    locked = next(l for m in detail['modules'] for l in m['lessons'] if l['id'] == str(lesson.id))
    assert locked['video_url'] == ''

    Enrollment.objects.create(user=student, course=paid_course)
    detail = auth(student).get(f'/api/v1/courses/{paid_course.slug}/').data
    url = next(l for m in detail['modules'] for l in m['lessons'] if l['id'] == str(lesson.id))['video_url']
    assert url.startswith('/api/v1/courses/media/') and url.endswith('/video')
    api.force_authenticate(None)
    resp = api.get(url)  # le jeton suffit (balise <video> sans en-tête Authorization)
    assert resp.status_code == 200 and b''.join(resp.streaming_content) == b'FAKE-MP4-DATA'

    token = url.split('/')[5]
    assert api.get(url.replace(token, token[:-2] + 'xx')).status_code == 403  # jeton falsifié
    assert api.get(url.replace('/video', '/../../../settings.py')).status_code in (403, 404)  # pas de traversée

    # Jeton d'un autre utilisateur non inscrit : refusé
    intruder = make_user('intrus@test.com')
    assert api.get(f'/api/v1/courses/media/{make_token(lesson, intruder)}/video').status_code == 403

    # Inscription annulée (remboursement) : le lien déjà émis ne fonctionne plus
    Enrollment.objects.filter(user=student).update(status='CANCELLED')
    assert api.get(url).status_code == 403


def test_expired_video_token(api, student, paid_course):
    lesson = _video_lesson(paid_course)
    Enrollment.objects.create(user=student, course=paid_course)
    token = make_token(lesson, student)
    with mock.patch('courses.media.signing.loads', side_effect=signing.SignatureExpired('expiré')):
        assert api.get(f'/api/v1/courses/media/{token}/video').status_code == 403
    assert signing.loads(token, salt=SALT)['l'] == str(lesson.id)


def test_offline_package(auth, student, paid_course):
    lesson = _video_lesson(paid_course)
    client = auth(student)
    assert client.get(f'/api/v1/courses/lessons/{lesson.id}/offline/').status_code == 403
    Enrollment.objects.create(user=student, course=paid_course)
    data = client.get(f'/api/v1/courses/lessons/{lesson.id}/offline/').data
    assert data['video_downloadable'] and data['video_download_url'].endswith('/video') and data['video_size'] == 13
    assert data['lesson']['title'] == lesson.title and data['course']['slug'] == paid_course.slug

    lesson.video_file = ''
    lesson.video_url = 'https://www.youtube.com/watch?v=abcdefghijk'
    lesson.save()
    data = client.get(f'/api/v1/courses/lessons/{lesson.id}/offline/').data
    assert data['video_downloadable'] is False and 'YouTube' in data['reason']


# ------------------------------------------------------------ Parcours
def test_learning_path_purchase_splits_revenue(auth, student, instructor, category, admin_user):
    other = make_user('sarah@test.com', role='FORMATEUR', verification_status='VERIFIED')
    c1 = build_course(instructor, category, price=60000, title='Cours A')
    c2 = build_course(other, category, price=40000, title='Cours B')

    teacher = auth(instructor)
    payload = {'title': 'Devenir développeur', 'description': 'Parcours complet', 'price': '80000', 'status': 'PUBLISHED',
               'course_slugs': [c1.slug, c2.slug]}
    assert teacher.post('/api/v1/paths/', payload, format='json').status_code == 400  # cours d'un autre formateur
    admin = auth(admin_user)
    assert admin.post('/api/v1/paths/', {**payload, 'price': '120000'}, format='json').status_code == 400  # trop cher
    resp = admin.post('/api/v1/paths/', payload, format='json')
    assert resp.status_code == 201
    slug = resp.data['slug']
    assert Decimal(str(resp.data['savings'])) == Decimal('20000')

    buyer = auth(student)
    resp = buyer.post(f'/api/v1/paths/{slug}/enroll/', {'gateway': 'WAVE'}, format='json')
    assert resp.status_code == 201 and resp.data['checkout_url']
    _confirm(buyer, resp.data['payment_id'])
    assert Enrollment.objects.filter(user=student, course__in=[c1, c2], status='ACTIVE').count() == 2
    # 80 000 réparti 60/40 entre les deux formateurs, puis 15 % de commission plateforme
    shares = {c.instructor_id: c.total_amount for c in Commission.objects.all()}
    assert shares == {instructor.id: Decimal('48000.00'), other.id: Decimal('32000.00')}
    detail = buyer.get(f'/api/v1/paths/{slug}/').data
    assert detail['owned_count'] == 2
    assert buyer.post(f'/api/v1/paths/{slug}/enroll/', {'gateway': 'WAVE'}, format='json').status_code == 400  # déjà tout


# ------------------------------------------------------------ Cohortes
def test_cohort_join_and_private_sessions(auth, api, student, instructor, paid_course):
    teacher = auth(instructor)
    start = timezone.localdate() + timedelta(days=7)
    resp = teacher.post('/api/v1/cohorts/instructor/', {
        'course_slug': paid_course.slug, 'title': 'Promo janvier', 'start_date': start.isoformat(),
        'end_date': (start + timedelta(days=30)).isoformat(), 'capacity': 2, 'price': '30000'}, format='json')
    assert resp.status_code == 201
    cohort_id = resp.data['id']

    # Session réservée à la promotion
    resp = teacher.post('/api/v1/sessions/create/', {
        'title': 'Live de la promo', 'description': 'Atelier', 'type': 'ONLINE',
        'start_at': (timezone.now() + timedelta(days=8)).isoformat(), 'duration': 60, 'capacity': 50, 'price': 5000,
        'cohort': cohort_id}, format='json')
    assert resp.status_code == 201
    session = LiveSession.objects.get(id=resp.data['id'])
    assert session.price == 0  # inclus dans le prix de la promotion
    api.force_authenticate(None)
    assert all(s['id'] != str(session.id) for s in api.get('/api/v1/sessions/').data['results'])
    assert auth(student).get(f'/api/v1/sessions/{session.id}/').status_code == 404
    assert auth(student).post(f'/api/v1/sessions/{session.id}/register/', {}, format='json').status_code in (400, 404)

    # Rejoindre la promotion (payante) : inscription au cours + à la session
    buyer = auth(student)
    resp = buyer.post(f'/api/v1/cohorts/{cohort_id}/join/', {'gateway': 'WAVE'}, format='json')
    assert resp.status_code == 201 and resp.data['checkout_url']
    _confirm(buyer, resp.data['payment_id'])
    assert CohortMembership.objects.get(user=student).status == 'CONFIRMED'
    assert Enrollment.objects.filter(user=student, course=paid_course).exists()
    assert SessionRegistration.objects.get(session=session, user=student).status == 'CONFIRMED'
    assert auth(student).get(f'/api/v1/sessions/{session.id}/').status_code == 200
    listing = auth(student).get(f'/api/v1/cohorts/course/{paid_course.slug}/').data
    assert listing[0]['membership_status'] == 'CONFIRMED' and listing[0]['members_count'] == 1
    assert Commission.objects.filter(instructor=instructor, total_amount=Decimal('30000')).exists()

    # Nouvelle session après l'adhésion : le membre y est inscrit automatiquement
    teacher = auth(instructor)  # le client de test est partagé : on se ré-authentifie en formateur
    resp = teacher.post('/api/v1/sessions/create/', {
        'title': 'Deuxième live', 'description': 'Suite', 'type': 'ONLINE',
        'start_at': (timezone.now() + timedelta(days=15)).isoformat(), 'duration': 60, 'capacity': 50,
        'cohort': cohort_id}, format='json')
    assert SessionRegistration.objects.filter(session_id=resp.data['id'], user=student, status='CONFIRMED').exists()


def test_cohort_capacity_and_ownership(auth, student, instructor, free_course):
    start = timezone.localdate() + timedelta(days=3)
    cohort = Cohort.objects.create(course=free_course, title='Mini promo', start_date=start,
                                   end_date=start + timedelta(days=10), capacity=1, price=0)
    assert auth(student).post(f'/api/v1/cohorts/{cohort.id}/join/', {}, format='json').data['status'] == 'CONFIRMED'
    late = make_user('retard@test.com')
    assert auth(late).post(f'/api/v1/cohorts/{cohort.id}/join/', {}, format='json').status_code == 400  # complet
    stranger = make_user('prof2@test.com', role='FORMATEUR', verification_status='VERIFIED')
    assert auth(stranger).patch(f'/api/v1/cohorts/{cohort.id}/', {'capacity': 99}, format='json').status_code == 403
    assert auth(stranger).post('/api/v1/cohorts/instructor/', {
        'course_slug': free_course.slug, 'title': 'Pirate', 'start_date': start.isoformat(),
        'end_date': start.isoformat()}, format='json').status_code == 403
