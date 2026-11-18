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
    path('verification/all/', views.UserVerificationListView.as_view(), name='user-verification-list'),
    path('verification/<int:pk>/update/', views.UserVerificationUpdateView.as_view(),
         name='user-verification-update'),
    path('verification/<int:pk>/document/<str:field>/', views.verification_document,
         name='user-verification-document'),

    # Administration des utilisateurs
    path('admin/users/', views.AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<uuid:pk>/', views.admin_set_user_status, name='admin-user-status'),

    # Recherche et recommandations
    path('search/', views.UserSearchView.as_view(), name='user-search'),
    path('recommendations/', views.user_recommendations, name='user-recommendations'),

    # Réseau social
    path('follow/', views.FollowUserView.as_view(), name='follow-user'),
    path('referral/', views.referral_overview, name='referral'),

    # 2FA
    path('two-factor/setup/', views.two_factor_setup, name='two-factor-setup'),
    path('two-factor/toggle/', views.toggle_two_factor, name='toggle-two-factor'),
]
