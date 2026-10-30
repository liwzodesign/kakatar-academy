from django.urls import path

from . import views

app_name = 'users'

urlpatterns = [
    # Authentification
    path('register/', views.UserRegistrationView.as_view(), name='user-register'),
    path('login/', views.UserLoginView.as_view(), name='user-login'),
    path('logout/', views.UserLogoutView.as_view(), name='user-logout'),

    # Profil utilisateur
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('profile/update/', views.UserProfileUpdateView.as_view(), name='user-profile-update'),
    path('stats/', views.UserStatsView.as_view(), name='user-stats'),

    # Mots de passe
    path('password/change/', views.PasswordChangeView.as_view(), name='password-change'),
    path('password/reset/', views.PasswordResetView.as_view(), name='password-reset'),
    path('password/reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # Vérification des comptes formateurs
    path('verification/', views.UserVerificationCreateView.as_view(), name='user-verification-create'),
    path('verification/detail/', views.UserVerificationDetailView.as_view(), name='user-verification-detail'),
    path('verification/<int:pk>/update/', views.UserVerificationUpdateView.as_view(), name='user-verification-update'),

    # V2 : recherche d'utilisateurs, recommandations, abonnements, double authentification
]
