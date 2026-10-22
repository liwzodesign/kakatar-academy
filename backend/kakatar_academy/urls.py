from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# GraphQL
from graphene_django.views import GraphQLView
from django.views.decorators.csrf import csrf_exempt

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API REST
    path('api/v1/', include([
        # Authentication
        path('auth/', include('users.urls')),
        
        # Courses
        path('courses/', include('courses.urls')),
        
        # Payments
        path('payments/', include('payments.urls')),
        
        # Live Sessions
        path('sessions/', include('sessions_live.urls')),
        
        # Marketplace
        path('marketplace/', include('marketplace.urls')),
        
        # Analytics
        path('analytics/', include('analytics.urls')),
        
        # AI Services
        path('ai/', include('ai_services.urls')),
    ])),
    
    # GraphQL
    path('graphql/', csrf_exempt(GraphQLView.as_view(graphiql=True))),
    
    # JWT Token endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Health check
    path('health/', TemplateView.as_view(template_name='health.html'), name='health'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Custom error handlers
handler404 = 'kakatar_academy.views.handler404'
handler500 = 'kakatar_academy.views.handler500' 