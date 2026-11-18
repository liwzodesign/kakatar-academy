from django.urls import path

from . import learning, views

app_name = 'analytics'

urlpatterns = [
    path('student/', views.student_dashboard, name='student-dashboard'),
    path('achievements/', views.achievements, name='achievements'),
    path('daily-goal/', views.daily_goal, name='daily-goal'),
    path('reviews/', learning.reviews, name='reviews'),
    path('reviews/<int:pk>/answer/', learning.review_answer, name='review-answer'),
    path('leaderboard/', learning.leaderboard, name='leaderboard'),
    path('public-profile/', learning.public_profile_settings, name='public-profile-settings'),
    path('profiles/<slug:handle>/', learning.public_profile, name='public-profile'),
    path('instructor/', views.instructor_dashboard, name='instructor-dashboard'),
    path('instructor/students/', views.instructor_students, name='instructor-students'),
    path('admin/', views.admin_dashboard, name='admin-dashboard'),
    path('export/<str:dataset>/', views.export_csv, name='export-csv'),
]
