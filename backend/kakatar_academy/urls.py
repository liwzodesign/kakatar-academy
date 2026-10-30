from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),

    # API REST
    path('api/v1/', include([
        path('auth/', include('users.urls')),
        path('courses/', include('courses.urls')),
        path('payments/', include('payments.urls')),
    ])),

    # JWT (la connexion se fait via /api/v1/auth/login/)
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    path('health/', views.health, name='health'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = 'kakatar_academy.views.handler404'
handler500 = 'kakatar_academy.views.handler500'
