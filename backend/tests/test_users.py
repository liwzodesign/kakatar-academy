import re

import pyotp
from django.core import mail

from users.models import User, UserProfile

from .conftest import PASSWORD


def test_register_login_and_profile(api, db):
    resp = api.post('/api/v1/auth/register/', {
        'email': 'Nouveau@Test.com', 'first_name': 'Awa', 'last_name': 'Diop', 'password': PASSWORD,
        'password_confirm': PASSWORD, 'role': 'ETUDIANT'}, format='json')
    assert resp.status_code == 201, resp.data
    assert resp.data['tokens']['access']
    user = User.objects.get(email='nouveau@test.com')
    assert user.username and UserProfile.objects.filter(user=user).exists()
    assert len(mail.outbox) == 1  # email de bienvenue

    resp = api.post('/api/v1/auth/login/', {'email': 'nouveau@test.com', 'password': PASSWORD}, format='json')
    assert resp.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['tokens']['access']}")
    resp = api.get('/api/v1/auth/profile/')
    assert resp.data['email'] == 'nouveau@test.com'
    resp = api.patch('/api/v1/auth/profile/', {'bio': 'Hello'}, format='json')
    assert resp.status_code == 200 and resp.data['bio'] == 'Hello'


def test_register_cannot_self_assign_admin(api, db):
    resp = api.post('/api/v1/auth/register/', {
        'email': 'pirate@test.com', 'first_name': 'X', 'last_name': 'Y', 'password': PASSWORD,
        'password_confirm': PASSWORD, 'role': 'ADMIN'}, format='json')
    assert resp.status_code == 400


def test_bad_login(api, student):
    resp = api.post('/api/v1/auth/login/', {'email': student.email, 'password': 'mauvais'}, format='json')
    assert resp.status_code == 400


def test_password_reset_flow(api, student):
    resp = api.post('/api/v1/auth/password/reset/', {'email': student.email}, format='json')
    assert resp.status_code == 200
    body = mail.outbox[-1].body
    uid, token = re.search(r'uid=([\w-]+)&(?:amp;)?token=([\w-]+)', mail.outbox[-1].alternatives[0][0]).groups()
    assert 'mot de passe' in body.lower()
    resp = api.post('/api/v1/auth/password/reset/confirm/', {
        'uid': uid, 'token': token, 'new_password': 'N0uveau-Secret!', 'new_password_confirm': 'N0uveau-Secret!'},
        format='json')
    assert resp.status_code == 200, resp.data
    student.refresh_from_db()
    assert student.check_password('N0uveau-Secret!')
    # Le lien n'est plus valable une fois utilisé
    resp = api.post('/api/v1/auth/password/reset/confirm/', {
        'uid': uid, 'token': token, 'new_password': 'Autre-Secret!9', 'new_password_confirm': 'Autre-Secret!9'},
        format='json')
    assert resp.status_code == 400


def test_two_factor(api, auth, student):
    client = auth(student)
    secret = client.post('/api/v1/auth/two-factor/setup/').data['secret']
    resp = client.post('/api/v1/auth/two-factor/toggle/', {'code': pyotp.TOTP(secret).now()}, format='json')
    assert resp.data['two_factor_enabled'] is True
    client.force_authenticate(None)
    resp = client.post('/api/v1/auth/login/', {'email': student.email, 'password': PASSWORD}, format='json')
    assert resp.status_code == 400 and 'otp_required' in resp.data
    resp = client.post('/api/v1/auth/login/', {'email': student.email, 'password': PASSWORD,
                                               'otp_code': pyotp.TOTP(secret).now()}, format='json')
    assert resp.status_code == 200


def test_follow_toggle(auth, student, instructor):
    client = auth(student)
    resp = client.post('/api/v1/auth/follow/', {'user_id': str(instructor.id)}, format='json')
    assert resp.data['action'] == 'followed' and resp.data['followers_count'] == 1
    assert instructor.profile.followers.filter(id=student.id).exists()
    resp = client.post('/api/v1/auth/follow/', {'user_id': str(instructor.id)}, format='json')
    assert resp.data['action'] == 'unfollowed'


def test_instructor_verification_flow(auth, admin_user, db):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from .conftest import make_user
    trainer = make_user('nouveau.formateur@test.com', role='FORMATEUR')
    client = auth(trainer)
    resp = client.post('/api/v1/auth/verification/', {
        'id_document': SimpleUploadedFile('id.pdf', b'%PDF-1.4', content_type='application/pdf'),
        'professional_cv': SimpleUploadedFile('cv.pdf', b'%PDF-1.4', content_type='application/pdf'),
    }, format='multipart')
    assert resp.status_code == 201, resp.data
    verification_id = trainer.verification.id
    client = auth(admin_user)
    resp = client.patch(f'/api/v1/auth/verification/{verification_id}/update/', {'status': 'APPROVED'},
                        format='json')
    assert resp.status_code == 200
    trainer.refresh_from_db()
    assert trainer.is_verified and trainer.verification_status == 'VERIFIED'
