from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from courses.models import Lesson
from marketplace.models import Order, Product
from sessions_live.models import LiveSession, SessionRegistration
from sessions_live.tasks import send_session_reminders


# ---------------------------------------------------------------------------
# Sessions en direct
# ---------------------------------------------------------------------------
def test_create_and_join_free_online_session(auth, instructor, student, future):
    resp = auth(instructor).post('/api/v1/sessions/create/', {
        'title': 'Live Q&A', 'description': 'Questions', 'type': 'ONLINE', 'start_at': future.isoformat(),
        'duration': 60, 'capacity': 2, 'price': 0}, format='json')
    assert resp.status_code == 201, resp.data
    session_id = resp.data['id']
    assert 'meet.jit.si' in resp.data['meeting_url']

    client = auth(student)
    listing = client.get('/api/v1/sessions/').data['results'][0]
    assert listing['meeting_url'] == ''  # caché aux non-inscrits
    resp = client.post(f'/api/v1/sessions/{session_id}/register/', {'expectations': 'Apprendre'}, format='json')
    assert resp.status_code == 201 and resp.data['registration']['status'] == 'CONFIRMED'
    assert client.get(f'/api/v1/sessions/{session_id}/').data['meeting_url']
    # Trop tôt pour rejoindre
    assert client.get(f'/api/v1/sessions/{session_id}/join/').status_code == 400


def test_paid_session_registration_via_payment(auth, instructor, student, future):
    session = LiveSession.objects.create(title='Atelier', description='D', instructor=instructor, type='PRESENTIAL',
                                         location='Dakar', start_at=future, price=20000, capacity=10)
    client = auth(student)
    assert client.post(f'/api/v1/sessions/{session.id}/register/', {}, format='json').status_code == 400
    resp = client.post(f'/api/v1/sessions/{session.id}/register/', {'gateway': 'MOBILE_MONEY'}, format='json')
    assert resp.status_code == 201 and resp.data['checkout_url']
    client.post(f"/api/v1/payments/{resp.data['payment_id']}/sandbox-confirm/", format='json')
    assert SessionRegistration.objects.get(session=session, user=student).status == 'CONFIRMED'


def test_session_full(auth, instructor, student, future, db):
    from .conftest import make_user
    session = LiveSession.objects.create(title='Mini', description='D', instructor=instructor, start_at=future,
                                         capacity=1)
    auth(make_user('premier@test.com')).post(f'/api/v1/sessions/{session.id}/register/', {}, format='json')
    resp = auth(student).post(f'/api/v1/sessions/{session.id}/register/', {}, format='json')
    assert resp.status_code == 400


def test_session_reminders(instructor, student):
    from django.core import mail
    session = LiveSession.objects.create(title='Bientôt', description='D', instructor=instructor,
                                         start_at=timezone.now() + timedelta(hours=1), capacity=5)
    SessionRegistration.objects.create(session=session, user=student, status='CONFIRMED')
    result = send_session_reminders()
    assert result['reminders_sent'] == 1
    assert 'Rappel' in mail.outbox[-1].subject
    assert send_session_reminders()['reminders_sent'] == 0  # pas de doublon


# ---------------------------------------------------------------------------
# Marketplace
# ---------------------------------------------------------------------------
def test_digital_product_purchase_and_secure_download(auth, instructor, student):
    client = auth(instructor)
    resp = client.post('/api/v1/marketplace/products/create/', {
        'title': 'Template Pro', 'description': 'Un template', 'type': 'TEMPLATE', 'price': '5000',
        'file': SimpleUploadedFile('template.zip', b'PK-contenu', content_type='application/zip')},
        format='multipart')
    assert resp.status_code == 201, resp.data
    slug = resp.data['slug']
    assert 'file' not in resp.data  # le fichier n'est jamais exposé

    buyer = auth(student)
    resp = buyer.post(f'/api/v1/marketplace/products/{slug}/purchase/', {'gateway': 'WAVE'}, format='json')
    order_id = resp.data['order']['id']
    assert buyer.get(f'/api/v1/marketplace/orders/{order_id}/download/').status_code == 403
    buyer.post(f"/api/v1/payments/{resp.data['payment_id']}/sandbox-confirm/", format='json')
    assert Order.objects.get(id=order_id).status == 'COMPLETED'
    download = buyer.get(f'/api/v1/marketplace/orders/{order_id}/download/')
    assert download.status_code == 200
    assert b''.join(download.streaming_content) == b'PK-contenu'
    assert Product.objects.get(slug=slug).sales_count == 1


def test_service_order_delivery(auth, instructor, student):
    product = Product.objects.create(seller=instructor, title='Coaching', description='1h', type='COACHING', price=0)
    buyer = auth(student)
    order_id = buyer.post(f'/api/v1/marketplace/products/{product.slug}/purchase/',
                          {'requirements': 'Préparer un entretien'}, format='json').data['order']['id']
    assert Order.objects.get(id=order_id).status == 'PAID'
    resp = auth(instructor).post(f'/api/v1/marketplace/orders/{order_id}/deliver/',
                                 {'delivery_message': 'Lien du call : ...'}, format='json')
    assert resp.data['status'] == 'DELIVERED'
    assert auth(student).post(f'/api/v1/marketplace/orders/{order_id}/complete/').data['status'] == 'COMPLETED'


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def test_dashboards_and_permissions(auth, student, instructor, admin_user, free_course):
    auth(student).post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert auth(student).get('/api/v1/analytics/student/').data['stats']['enrolled_courses'] == 1
    data = auth(instructor).get('/api/v1/analytics/instructor/').data
    assert data['stats']['total_students'] == 1 and len(data['enrollments_30_days']) == 30
    assert auth(student).get('/api/v1/analytics/admin/').status_code == 403
    assert auth(admin_user).get('/api/v1/analytics/admin/').data['stats']['total_users'] == 3


def test_csv_exports(auth, student, admin_user, free_course):
    auth(student).post(f'/api/v1/courses/{free_course.slug}/enroll/')
    resp = auth(admin_user).get('/api/v1/analytics/export/users/')
    assert resp.status_code == 200 and 'etudiant@test.com' in resp.content.decode('utf-8-sig')
    assert auth(student).get('/api/v1/analytics/export/users/').status_code == 404


def test_daily_snapshot(free_course):
    from analytics.tasks import compute_daily_snapshot
    from analytics.models import DailySnapshot
    compute_daily_snapshot(timezone.localdate().isoformat())
    assert DailySnapshot.objects.get(date=timezone.localdate()).total_users >= 1


# ---------------------------------------------------------------------------
# IA (mode local, sans clé OpenAI)
# ---------------------------------------------------------------------------
LONG_TEXT = ("Le composant React reçoit des propriétés depuis son parent. L'état local permet au composant de "
             "mémoriser des informations entre deux rendus. Les hooks comme useEffect gèrent les effets de bord "
             "après le rendu. La mémorisation avec useMemo évite des calculs coûteux inutiles. Le contexte partage "
             "des données globales sans passer les propriétés à chaque niveau.")


def test_ai_quiz_generation_and_tutor(auth, instructor, student, free_course):
    lesson = Lesson.objects.filter(module__course=free_course).first()
    lesson.content = LONG_TEXT
    lesson.save()
    resp = auth(instructor).post(f'/api/v1/ai/lessons/{lesson.id}/quiz/', {'num_questions': 3, 'save': True},
                                 format='json')
    assert resp.status_code == 200, resp.data
    assert resp.data['engine'] == 'local' and 1 <= len(resp.data['questions']) <= 3
    lesson.refresh_from_db()
    assert lesson.quiz
    assert auth(student).post(f'/api/v1/ai/lessons/{lesson.id}/quiz/').status_code == 403

    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    resp = client.post('/api/v1/ai/tutor/', {'lesson_id': str(lesson.id), 'question': 'À quoi sert useEffect ?'},
                       format='json')
    assert 'useEffect' in resp.data['answer']
    resp = client.post(f'/api/v1/ai/lessons/{lesson.id}/summary/')
    assert resp.data['summary']


def test_ai_recommendations(auth, student, free_course, paid_course):
    resp = auth(student).get('/api/v1/ai/recommendations/')
    assert {c['slug'] for c in resp.data} == {free_course.slug, paid_course.slug}
