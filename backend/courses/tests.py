from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from .models import Category, Course, Enrollment, Lesson, Module


class CourseAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user('prof@test.sn', 'Passw0rd!x', first_name='Prof', last_name='K',
                                                role='FORMATEUR', verification_status='VERIFIED')
        self.student = User.objects.create_user('eleve@test.sn', 'Passw0rd!x', first_name='Awa', last_name='Diop')
        cat = Category.objects.create(name='Web', slug='web')
        self.paid = Course.objects.create(title='PHP', slug='php', description='d', category=cat,
                                          instructor=self.teacher, price=Decimal('35000'), type='PAID',
                                          status='PUBLISHED')
        self.free = Course.objects.create(title='Initiation', slug='init', description='d', category=cat,
                                          instructor=self.teacher, price=0, type='FREE', status='PUBLISHED')
        self.draft = Course.objects.create(title='Brouillon', slug='brouillon', description='d', category=cat,
                                           instructor=self.teacher, price=0, type='FREE')
        m = Module.objects.create(course=self.paid, title='M1', order=1)
        self.preview = Lesson.objects.create(module=m, title='Aperçu', order=1, status='PUBLISHED',
                                             is_free=True, content='visible', estimated_duration=5)
        self.locked = Lesson.objects.create(module=m, title='Payant', order=2, status='PUBLISHED',
                                            content='SECRET', video_url='https://v/1', estimated_duration=5)
        fm = Module.objects.create(course=self.free, title='M1', order=1)
        self.f1 = Lesson.objects.create(module=fm, title='L1', order=1, status='PUBLISHED', estimated_duration=30)
        self.f2 = Lesson.objects.create(module=fm, title='L2', order=2, status='PUBLISHED', estimated_duration=30)
        Lesson.objects.create(module=fm, title='Pas prête', order=3, status='DRAFT')

    def test_catalog_lists_only_published(self):
        r = self.client.get('/api/v1/courses/')
        slugs = {c['slug'] for c in r.json()['results']}
        self.assertEqual(slugs, {'php', 'init'})

    def test_paid_content_hidden_from_anonymous_and_non_enrolled(self):
        detail = self.client.get('/api/v1/courses/php/').json()
        lessons = {l['title']: l for l in detail['modules'][0]['lessons']}
        self.assertEqual(lessons['Aperçu']['content'], 'visible')
        self.assertTrue(lessons['Payant']['is_locked'])
        self.assertEqual(lessons['Payant']['content'], '')
        self.assertEqual(lessons['Payant']['video_url'], '')
        self.assertNotIn('SECRET', str(detail))
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f'/api/v1/courses/lessons/{self.locked.id}/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/v1/courses/lessons/{self.preview.id}/').status_code, 200)

    def test_enrolled_student_sees_content(self):
        Enrollment.objects.create(user=self.student, course=self.paid)
        self.client.force_authenticate(self.student)
        r = self.client.get(f'/api/v1/courses/lessons/{self.locked.id}/')
        self.assertEqual(r.json()['content'], 'SECRET')

    def test_routes_are_not_swallowed_by_slug(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get('/api/v1/courses/enrollments/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/courses/categories/').status_code, 200)

    def test_free_course_progress_and_certificate(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post('/api/v1/courses/init/enroll/').status_code, 201)
        self.free.refresh_from_db()
        self.assertEqual(self.free.lessons_count, 2)  # brouillon exclu
        self.assertEqual(self.client.get('/api/v1/courses/init/certificate/').status_code, 403)
        r = self.client.post(f'/api/v1/courses/lessons/{self.f1.id}/complete/').json()
        self.assertEqual(Decimal(str(r['progress'])), Decimal('50'))
        r = self.client.post(f'/api/v1/courses/lessons/{self.f2.id}/complete/').json()
        self.assertEqual(r['status'], 'COMPLETED')
        self.assertTrue(r['certificate_issued'])
        pdf = self.client.get('/api/v1/courses/init/certificate/')
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        anon = APIClient().get(f"/api/v1/courses/certificates/verify/{r['certificate_code']}/").json()
        self.assertTrue(anon['valid'])
        self.assertEqual(anon['student'], 'Awa Diop')

    def test_only_owner_can_edit_course(self):
        self.client.force_authenticate(self.student)
        r = self.client.patch('/api/v1/courses/php/update/', {'price': 1}, format='json')
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.teacher)
        r = self.client.patch('/api/v1/courses/php/update/', {'price': 30000}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_seed_command_is_idempotent(self):
        call_command('seed_kakatar_courses', instructor='prof@test.sn', publish=True)
        call_command('seed_kakatar_courses', instructor='prof@test.sn')
        self.assertEqual(Course.objects.filter(slug__in=[
            'infographie-fondamentaux', 'html-css-php', 'initiation-informatique']).count(), 3)
        self.assertEqual(Course.objects.get(slug='initiation-informatique').modules.count(), 6)


class AuthTests(TestCase):
    def test_register_login_and_role_escalation_blocked(self):
        c = APIClient()
        r = c.post('/api/v1/auth/register/', {
            'email': 'New@Test.sn', 'first_name': 'A', 'last_name': 'B', 'role': 'ADMIN',
            'password': 'Passw0rd!xyz', 'password_confirm': 'Passw0rd!xyz'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = c.post('/api/v1/auth/register/', {
            'email': 'New@Test.sn', 'first_name': 'A', 'last_name': 'B',
            'password': 'Passw0rd!xyz', 'password_confirm': 'Passw0rd!xyz'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['user']['role'], 'ETUDIANT')
        r = c.post('/api/v1/auth/login/', {'email': 'new@test.sn', 'password': 'Passw0rd!xyz'}, format='json')
        self.assertEqual(r.status_code, 200)
        c.credentials(HTTP_AUTHORIZATION='Bearer ' + r.json()['tokens']['access'])
        r = c.patch('/api/v1/auth/profile/', {'role': 'ADMIN', 'city': 'Mbour'}, format='json')
        self.assertEqual(r.status_code, 200)
        user = User.objects.get(email='new@test.sn')
        self.assertEqual(user.role, 'ETUDIANT')
        self.assertEqual(user.city, 'Mbour')

    def test_password_reset_roundtrip(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        user = User.objects.create_user('r@test.sn', 'Passw0rd!x', first_name='R', last_name='S')
        c = APIClient()
        self.assertEqual(c.post('/api/v1/auth/password/reset/', {'email': 'r@test.sn'}).status_code, 200)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        r = c.post('/api/v1/auth/password/reset/confirm/', {
            'uid': uid, 'token': token, 'new_password': 'N0uveau!pass', 'new_password_confirm': 'N0uveau!pass'})
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('N0uveau!pass'))
        r = c.post('/api/v1/auth/password/reset/confirm/', {
            'uid': uid, 'token': token, 'new_password': 'Autre!pass9', 'new_password_confirm': 'Autre!pass9'})
        self.assertEqual(r.status_code, 400)  # token à usage unique
