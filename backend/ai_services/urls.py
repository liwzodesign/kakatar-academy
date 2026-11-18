from django.urls import path

from . import views

app_name = 'ai_services'

urlpatterns = [
    path('status/', views.ai_status, name='status'),
    path('recommendations/', views.recommendations, name='recommendations'),
    path('lessons/<uuid:lesson_id>/quiz/', views.generate_quiz, name='generate-quiz'),
    path('lessons/<uuid:lesson_id>/summary/', views.summarize_lesson, name='summarize-lesson'),
    path('tutor/', views.tutor, name='tutor'),
    path('moderate/', views.moderate, name='moderate'),
]
