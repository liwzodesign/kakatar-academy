from django.urls import path

from . import views

app_name = 'payments'

urlpatterns = [
    path('config/', views.payment_config, name='config'),
    path('checkout/', views.checkout, name='checkout'),
    path('history/', views.MyPaymentsView.as_view(), name='history'),
    path('<uuid:pk>/', views.payment_status, name='status'),
    path('<uuid:pk>/sandbox-confirm/', views.sandbox_confirm, name='sandbox-confirm'),

    # Webhooks
    path('webhooks/stripe/', views.stripe_webhook, name='webhook-stripe'),
    path('webhooks/paydunya/', views.paydunya_webhook, name='webhook-paydunya'),
    path('webhooks/wave/', views.wave_webhook, name='webhook-wave'),

    # Coupons
    path('coupons/validate/', views.validate_coupon, name='coupon-validate'),
    path('coupons/', views.CouponListCreateView.as_view(), name='coupon-list'),
    path('coupons/<uuid:pk>/', views.CouponDetailView.as_view(), name='coupon-detail'),
    path('instructor/coupons/', views.InstructorCouponListCreateView.as_view(), name='instructor-coupons'),
    path('instructor/coupons/<uuid:pk>/', views.InstructorCouponDetailView.as_view(), name='instructor-coupon-detail'),

    # Abonnements
    path('subscription/', views.my_subscription, name='subscription'),
    path('subscription/cancel/', views.cancel_subscription, name='subscription-cancel'),

    # Formateurs
    path('earnings/', views.instructor_earnings, name='earnings'),
    path('payouts/', views.my_payout_requests, name='my-payouts'),

    # Administration
    path('admin/payments/', views.AdminPaymentListView.as_view(), name='admin-payments'),
    path('admin/payments/<uuid:pk>/refund/', views.admin_refund, name='admin-refund'),
    path('admin/payouts/', views.admin_payouts, name='admin-payouts'),
    path('admin/payouts/mark-paid/', views.admin_mark_commissions_paid, name='admin-payouts-mark-paid'),
    path('admin/payout-requests/', views.admin_payout_requests, name='admin-payout-requests'),
    path('admin/payout-requests/<uuid:pk>/', views.admin_process_payout, name='admin-process-payout'),
]
