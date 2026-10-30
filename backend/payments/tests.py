import hashlib
import hmac
import json
import time
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from courses.models import Category, Course, Enrollment, Lesson, Module
from users.models import User

from .models import Commission, Payment

WAVE_SECRET = 'wave_secret_test'
PD_MASTER = 'pd_master_test'

GATEWAY_SETTINGS = dict(
    WAVE_API_KEY='wave_sn_test', WAVE_WEBHOOK_SECRET=WAVE_SECRET,
    PAYDUNYA_MASTER_KEY=PD_MASTER, PAYDUNYA_PRIVATE_KEY='pk', PAYDUNYA_TOKEN='tk',
    FRONTEND_URL='https://academy.test', BACKEND_URL='https://api.academy.test',
)


def fake_response(status_code, payload):
    r = mock.Mock()
    r.status_code = status_code
    r.json.return_value = payload
    r.text = json.dumps(payload)
    return r


class BaseCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user('prof@test.sn', 'Passw0rd!x', first_name='Prof', last_name='K',
                                                role='FORMATEUR', verification_status='VERIFIED')
        self.student = User.objects.create_user('eleve@test.sn', 'Passw0rd!x', first_name='Awa', last_name='Diop')
        cat = Category.objects.create(name='Web', slug='web')
        self.course = Course.objects.create(
            title='HTML', slug='html', description='d', category=cat, instructor=self.teacher,
            price=Decimal('35000'), type='PAID', status='PUBLISHED')
        module = Module.objects.create(course=self.course, title='M1', order=1)
        self.free_lesson = Lesson.objects.create(module=module, title='Intro', order=1, status='PUBLISHED',
                                                 is_free=True, content='libre', estimated_duration=10)
        self.paid_lesson = Lesson.objects.create(module=module, title='Suite', order=2, status='PUBLISHED',
                                                 content='SECRET', estimated_duration=10)
        self.client.force_authenticate(self.student)


@override_settings(**GATEWAY_SETTINGS)
class WaveCheckoutTests(BaseCase):
    @mock.patch('payments.gateways.requests.post')
    def test_checkout_creates_wave_session(self, post):
        post.return_value = fake_response(200, {'id': 'cos-abc', 'wave_launch_url': 'https://pay.wave.com/c/cos-abc',
                                                'checkout_status': 'open'})
        r = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['checkout_url'], 'https://pay.wave.com/c/cos-abc')
        body = post.call_args.kwargs['json']
        self.assertEqual(body['amount'], '35000')
        self.assertEqual(body['currency'], 'XOF')
        self.assertTrue(body['success_url'].startswith('https://academy.test/paiement/retour'))
        payment = Payment.objects.get()
        self.assertEqual(payment.status, 'PROCESSING')
        self.assertFalse(Enrollment.objects.exists())  # pas d'accès avant paiement

    @mock.patch('payments.gateways.requests.get')
    @mock.patch('payments.gateways.requests.post')
    def test_return_page_sync_grants_access_once(self, post, get):
        post.return_value = fake_response(200, {'id': 'cos-abc', 'wave_launch_url': 'https://x'})
        pid = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'},
                               format='json').json()['id']
        get.return_value = fake_response(200, {'id': 'cos-abc', 'payment_status': 'succeeded',
                                               'checkout_status': 'complete', 'amount': '35000'})
        for _ in range(2):  # idempotent
            r = self.client.get(f'/api/v1/payments/{pid}/')
            self.assertEqual(r.json()['status'], 'COMPLETED')
        self.assertEqual(Enrollment.objects.filter(user=self.student, course=self.course).count(), 1)
        self.assertEqual(Commission.objects.count(), 1)
        self.assertEqual(Commission.objects.get().instructor_amount, Decimal('29750'))

    @mock.patch('payments.gateways.requests.get')
    @mock.patch('payments.gateways.requests.post')
    def test_amount_mismatch_is_rejected(self, post, get):
        post.return_value = fake_response(200, {'id': 'cos-abc', 'wave_launch_url': 'https://x'})
        pid = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'},
                               format='json').json()['id']
        get.return_value = fake_response(200, {'payment_status': 'succeeded', 'amount': '100'})
        self.assertEqual(self.client.get(f'/api/v1/payments/{pid}/').json()['status'], 'FAILED')
        self.assertFalse(Enrollment.objects.exists())

    @mock.patch('payments.gateways.requests.get')
    @mock.patch('payments.gateways.requests.post')
    def test_webhook_requires_valid_signature(self, post, get):
        post.return_value = fake_response(200, {'id': 'cos-abc', 'wave_launch_url': 'https://x'})
        self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'}, format='json')
        get.return_value = fake_response(200, {'payment_status': 'succeeded', 'amount': '35000'})
        anon = APIClient()
        body = json.dumps({'type': 'checkout.session.completed', 'data': {'id': 'cos-abc'}}).encode()

        r = anon.post('/api/v1/payments/webhooks/wave/', body, content_type='application/json',
                      HTTP_WAVE_SIGNATURE='t=1,v1=deadbeef')
        self.assertEqual(r.status_code, 401)
        self.assertFalse(Enrollment.objects.exists())

        ts = str(int(time.time()))
        sig = hmac.new(WAVE_SECRET.encode(), ts.encode() + body, hashlib.sha256).hexdigest()
        r = anon.post('/api/v1/payments/webhooks/wave/', body, content_type='application/json',
                      HTTP_WAVE_SIGNATURE=f't={ts},v1={sig}')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(Enrollment.objects.filter(user=self.student, course=self.course).exists())

    def test_cannot_buy_twice_or_enroll_free_in_paid_course(self):
        r = self.client.post('/api/v1/courses/html/enroll/')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.json()['requires_payment'])
        Enrollment.objects.create(user=self.student, course=self.course)
        r = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'}, format='json')
        self.assertEqual(r.status_code, 400)

    @override_settings(WAVE_API_KEY='')
    def test_unconfigured_gateway_is_hidden_and_refused(self):
        methods = [m['code'] for m in self.client.get('/api/v1/payments/methods/').json()]
        self.assertNotIn('WAVE', methods)
        r = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'WAVE'}, format='json')
        self.assertEqual(r.status_code, 400)


@override_settings(**GATEWAY_SETTINGS)
class PayDunyaTests(BaseCase):
    @mock.patch('payments.gateways.requests.get')
    @mock.patch('payments.gateways.requests.post')
    def test_ipn_flow(self, post, get):
        post.return_value = fake_response(200, {'response_code': '00', 'token': 'tok_1',
                                                'response_text': 'https://app.paydunya.com/sandbox-checkout/invoice/tok_1'})
        r = self.client.post('/api/v1/payments/checkout/', {'course_slug': 'html', 'gateway': 'PAYDUNYA'},
                             format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIn('sandbox-api', post.call_args.args[0])
        get.return_value = fake_response(200, {'status': 'completed', 'invoice': {'total_amount': 35000}})

        anon = APIClient()
        bad = anon.post('/api/v1/payments/webhooks/paydunya/', {'data[hash]': 'x', 'data[invoice][token]': 'tok_1'})
        self.assertEqual(bad.status_code, 401)
        good_hash = hashlib.sha512(PD_MASTER.encode()).hexdigest()
        ok = anon.post('/api/v1/payments/webhooks/paydunya/',
                       {'data[hash]': good_hash, 'data[invoice][token]': 'tok_1'})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(Payment.objects.get().status, 'COMPLETED')
        self.assertTrue(Enrollment.objects.filter(user=self.student).exists())
