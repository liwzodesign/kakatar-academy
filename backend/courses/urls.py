from django.urls import path, include
from . import views

app_name = 'courses'

urlpatterns = [
    # Catégories
    path('categories/', views.CategoryListView.as_view(), name='category-list'),
    
    # Cours
    path('', views.CourseListView.as_view(), name='course-list'),
    path('search/', views.CourseSearchView.as_view(), name='course-search'),
    path('featured/', views.featured_courses, name='featured-courses'),
    path('trending/', views.trending_courses, name='trending-courses'),
    
    # Création et gestion des cours
    path('create/', views.CourseCreateView.as_view(), name='course-create'),
    path('<slug:slug>/', views.CourseDetailView.as_view(), name='course-detail'),
    path('<slug:slug>/update/', views.CourseUpdateView.as_view(), name='course-update'),
    path('<slug:slug>/delete/', views.CourseDeleteView.as_view(), name='course-delete'),
    
    # Modules
    path('<slug:course_slug>/modules/', views.ModuleListView.as_view(), name='module-list'),
    path('<slug:course_slug>/modules/create/', views.ModuleCreateView.as_view(), name='module-create'),
    
    # Leçons
    path('modules/<uuid:module_id>/lessons/', views.LessonListView.as_view(), name='lesson-list'),
    path('modules/<uuid:module_id>/lessons/create/', views.LessonCreateView.as_view(), name='lesson-create'),
    path('lessons/<uuid:pk>/', views.LessonDetailView.as_view(), name='lesson-detail'),
    
    # Inscriptions
    path('<slug:course_slug>/enroll/', views.EnrollmentCreateView.as_view(), name='enroll'),
    path('enrollments/', views.EnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/<uuid:pk>/', views.EnrollmentDetailView.as_view(), name='enrollment-detail'),
    
    # Avis
    path('<slug:course_slug>/reviews/', views.CourseReviewListView.as_view(), name='review-list'),
    path('<slug:course_slug>/reviews/create/', views.CourseReviewCreateView.as_view(), name='review-create'),
    
    # Progression et actions
    path('lessons/<uuid:lesson_id>/complete/', views.mark_lesson_completed, name='mark-lesson-completed'),
    path('<slug:course_slug>/progress/', views.course_progress, name='course-progress'),
    
    # Instructeurs
    path('instructor/<uuid:instructor_id>/courses/', views.instructor_courses, name='instructor-courses'),
    
    # Favoris
    path('<slug:course_slug>/favorite/', views.toggle_course_favorite, name='toggle-favorite'),
    
    # Analytics (pour instructeurs)
    path('<slug:course_slug>/analytics/', views.course_analytics, name='course-analytics'),
] 