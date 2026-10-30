from django.urls import path

from . import views

app_name = 'payments'

urlpatterns = [
    path('methods/', views.available_methods, name='methods'),
    path('quote/', views.quote, name='quote'),
    path('checkout/', views.checkout, name='checkout'),
    path('mine/', views.my_payments, name='my-payments'),
    path('webhooks/wave/', views.wave_webhook, name='wave-webhook'),
    path('webhooks/paydunya/', views.paydunya_webhook, name='paydunya-webhook'),
    path('<uuid:pk>/', views.payment_detail, name='payment-detail'),
]
