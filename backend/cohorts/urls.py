from django.urls import path

from . import views

app_name = 'cohorts'

urlpatterns = [
    path('instructor/', views.instructor_cohorts, name='instructor'),
    path('course/<slug:slug>/', views.course_cohorts, name='course'),
    path('<uuid:pk>/', views.cohort_detail, name='detail'),
    path('<uuid:pk>/members/', views.cohort_members, name='members'),
    path('<uuid:pk>/join/', views.join_cohort, name='join'),
]
