from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from . import views

admin.site.site_header = 'Kakatar Academy — Administration'
admin.site.site_title = 'Kakatar Academy'

api_v1 = [
    path('auth/', include('users.urls')),
    path('courses/', include('courses.urls')),
    path('payments/', include('payments.urls')),
    path('sessions/', include('sessions_live.urls')),
    path('marketplace/', include('marketplace.urls')),
    path('analytics/', include('analytics.urls')),
    path('ai/', include('ai_services.urls')),
    path('notifications/', include('notifications.urls')),
    path('community/', include('community.urls')),
    path('assignments/', include('assignments.urls')),
    path('paths/', include('paths.urls')),
    path('cohorts/', include('cohorts.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(api_v1)),
    path('graphql/', csrf_exempt(GraphQLView.as_view(graphiql=settings.DEBUG))),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('health/', views.health, name='health'),
    path('', include('django_prometheus.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = 'kakatar_academy.views.handler404'
handler500 = 'kakatar_academy.views.handler500'
