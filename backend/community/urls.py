from django.urls import path

from . import views

app_name = 'community'

urlpatterns = [
    path('lessons/<uuid:lesson_id>/threads/', views.lesson_threads, name='lesson-threads'),
    path('threads/<uuid:pk>/replies/', views.reply, name='reply'),
    path('threads/<uuid:pk>/resolve/', views.toggle_resolved, name='resolve'),
    path('comments/<uuid:pk>/like/', views.toggle_like, name='like'),
    path('comments/<uuid:pk>/', views.delete_comment, name='delete'),
    path('instructor/inbox/', views.instructor_inbox, name='instructor-inbox'),
    path('courses/<slug:slug>/announcements/', views.course_announcements, name='announcements'),
]
