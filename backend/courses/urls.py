from django.urls import path

from . import views

app_name = 'courses'

# Les routes fixes viennent AVANT '<slug>/' pour ne pas être capturées par le slug.
urlpatterns = [
    path('', views.CourseListView.as_view(), name='course-list'),
    path('categories/', views.CategoryListView.as_view(), name='category-list'),
    path('featured/', views.featured_courses, name='featured-courses'),
    path('create/', views.CourseCreateView.as_view(), name='course-create'),
    path('mine/', views.InstructorCourseListView.as_view(), name='instructor-courses'),

    path('enrollments/', views.EnrollmentListView.as_view(), name='enrollment-list'),

    path('modules/<uuid:module_id>/lessons/create/', views.LessonCreateView.as_view(), name='lesson-create'),
    path('lessons/<uuid:pk>/', views.LessonDetailView.as_view(), name='lesson-detail'),
    path('lessons/<uuid:lesson_id>/complete/', views.mark_lesson_completed, name='mark-lesson-completed'),

    path('certificates/verify/<str:code>/', views.verify_certificate, name='certificate-verify'),

    path('<slug:slug>/', views.CourseDetailView.as_view(), name='course-detail'),
    path('<slug:slug>/update/', views.CourseUpdateView.as_view(), name='course-update'),
    path('<slug:slug>/delete/', views.CourseDeleteView.as_view(), name='course-delete'),
    path('<slug:course_slug>/modules/create/', views.ModuleCreateView.as_view(), name='module-create'),
    path('<slug:course_slug>/enroll/', views.EnrollmentCreateView.as_view(), name='enroll'),
    path('<slug:course_slug>/progress/', views.course_progress, name='course-progress'),
    path('<slug:course_slug>/certificate/', views.download_certificate, name='certificate-download'),
    path('<slug:course_slug>/reviews/', views.CourseReviewListView.as_view(), name='review-list'),
    path('<slug:course_slug>/reviews/create/', views.CourseReviewCreateView.as_view(), name='review-create'),
    path('<slug:course_slug>/analytics/', views.course_analytics, name='course-analytics'),
]
