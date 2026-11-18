import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from courses.models import Enrollment
from payments.gateways import StripeGateway, WaveGateway
from payments.models import Commission, Coupon, Payment, Subscription


def _checkout(client, **data):
    return client.post('/api/v1/payments/checkout/', {'gateway': 'WAVE', **data}, format='json')


def test_course_purchase_sandbox_flow(auth, student, paid_course):
    client = auth(student)
    resp = _checkout(client, course_slug=paid_course.slug)
    assert resp.status_code == 201, resp.data
    assert '/payment/sandbox' in resp.data['checkout_url']
    payment_id = resp.data['payment']['id']
    assert not Enrollment.objects.filter(user=student, course=paid_course).exists()

    resp = client.post(f'/api/v1/payments/{payment_id}/sandbox-confirm/', {'action': 'confirm'}, format='json')
    assert resp.data['status'] == 'COMPLETED'
    assert Enrollment.objects.get(user=student, course=paid_course).status == 'ACTIVE'
    commission = Commission.objects.get(payment_id=payment_id)
    assert commission.commission_amount == Decimal('7500.00')  # 15 % de 50 000
    assert commission.instructor_amount == Decimal('42500.00')

    # Idempotence : une seconde confirmation ne crée rien en double
    client.post(f'/api/v1/payments/{payment_id}/sandbox-confirm/', format='json')
    assert Commission.objects.filter(payment_id=payment_id).count() == 1

    # Plus de checkout possible une fois inscrit
    assert _checkout(client, course_slug=paid_course.slug).status_code == 400


def test_coupon_applied(auth, student, paid_course):
    now = timezone.now()
    Coupon.objects.create(code='MOITIE', discount_type='PERCENTAGE', discount_value=50,
                          valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=1))
    client = auth(student)
    resp = client.post('/api/v1/payments/coupons/validate/', {'code': 'moitie', 'course_slug': paid_course.slug},
                       format='json')
    assert resp.data['valid'] and Decimal(resp.data['final_amount']) == Decimal('25000')
    resp = _checkout(client, course_slug=paid_course.slug, coupon_code='MOITIE')
    assert Decimal(resp.data['payment']['amount']) == Decimal('25000.00')
    client.post(f"/api/v1/payments/{resp.data['payment']['id']}/sandbox-confirm/", format='json')
    assert Coupon.objects.get(code='MOITIE').usage_count == 1


def test_invalid_coupon(auth, student, paid_course):
    resp = _checkout(auth(student), course_slug=paid_course.slug, coupon_code='NEXISTEPAS')
    assert resp.status_code == 400


def test_subscription_gives_access_to_subscription_courses(auth, student, paid_course):
    paid_course.type = 'SUBSCRIPTION'
    paid_course.save()
    client = auth(student)
    assert client.post(f'/api/v1/courses/{paid_course.slug}/enroll/').status_code == 402
    resp = _checkout(client, plan='PREMIUM', months=1)
    client.post(f"/api/v1/payments/{resp.data['payment']['id']}/sandbox-confirm/", format='json')
    assert Subscription.objects.active_for(student).exists()
    assert client.post(f'/api/v1/courses/{paid_course.slug}/enroll/').status_code == 201


def test_refund_cancels_enrollment(auth, student, admin_user, paid_course):
    client = auth(student)
    payment_id = _checkout(client, course_slug=paid_course.slug).data['payment']['id']
    client.post(f'/api/v1/payments/{payment_id}/sandbox-confirm/', format='json')
    resp = auth(admin_user).post(f'/api/v1/payments/admin/payments/{payment_id}/refund/', {'reason': 'test'},
                                 format='json')
    assert resp.data['status'] == 'REFUNDED'
    assert Enrollment.objects.get(user=student, course=paid_course).status == 'CANCELLED'
    assert not Commission.objects.filter(payment_id=payment_id).exists()


def test_student_cannot_refund(auth, student, paid_course):
    client = auth(student)
    payment_id = _checkout(client, course_slug=paid_course.slug).data['payment']['id']
    assert client.post(f'/api/v1/payments/admin/payments/{payment_id}/refund/').status_code == 403


def test_sandbox_disabled_in_production(auth, student, paid_course, settings):
    settings.PAYMENTS_ALLOW_SANDBOX = False
    resp = _checkout(auth(student), course_slug=paid_course.slug)
    assert resp.status_code == 400


def test_wave_webhook_signature(api, student, paid_course, settings):
    settings.WAVE_WEBHOOK_SECRET = 'wave_secret'
    payment = Payment.objects.create(user=student, amount=50000, gateway='WAVE', type='COURSE_PURCHASE')
    from payments.models import CoursePurchase
    CoursePurchase.objects.create(payment=payment, course=paid_course, original_price=50000, final_price=50000)
    body = json.dumps({'id': 'evt_1', 'type': 'checkout.session.completed',
                       'data': {'client_reference': str(payment.id), 'payment_status': 'succeeded'}}).encode()
    timestamp = '1700000000'
    sig = hmac.new(b'wave_secret', timestamp.encode() + body, hashlib.sha256).hexdigest()

    bad = api.post('/api/v1/payments/webhooks/wave/', body, content_type='application/json',
                   HTTP_WAVE_SIGNATURE=f't={timestamp},v1=deadbeef')
    assert bad.status_code == 400
    ok = api.post('/api/v1/payments/webhooks/wave/', body, content_type='application/json',
                  HTTP_WAVE_SIGNATURE=f't={timestamp},v1={sig}')
    assert ok.status_code == 200
    payment.refresh_from_db()
    assert payment.status == 'COMPLETED'
    assert WaveGateway.valid_signature(body, f't={timestamp},v1={sig}')


def test_stripe_minor_units():
    assert StripeGateway.to_minor_units(Decimal('50000'), 'XOF') == 50000
    assert StripeGateway.to_minor_units(Decimal('19.99'), 'EUR') == 1999


def test_instructor_earnings(auth, student, instructor, paid_course):
    client = auth(student)
    payment_id = _checkout(client, course_slug=paid_course.slug).data['payment']['id']
    client.post(f'/api/v1/payments/{payment_id}/sandbox-confirm/', format='json')
    resp = auth(instructor).get('/api/v1/payments/earnings/')
    assert Decimal(str(resp.data['net_total'])) == Decimal('42500')
    instructor.refresh_from_db()
    assert instructor.total_revenue == Decimal('42500')
