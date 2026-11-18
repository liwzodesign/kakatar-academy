from django.urls import path

from . import views

app_name = 'assignments'

urlpatterns = [
    path('lessons/<uuid:lesson_id>/submission/', views.my_submission, name='my-submission'),
    path('instructor/', views.instructor_submissions, name='instructor-submissions'),
    path('submissions/<uuid:pk>/review/', views.review_submission, name='review'),
    path('submissions/<uuid:pk>/file/', views.submission_file, name='file'),
]
