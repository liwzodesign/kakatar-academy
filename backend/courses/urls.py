from django.urls import path

from . import views

app_name = 'courses'

# NB : les routes fixes doivent précéder « <slug:slug>/ » qui capture tout.
urlpatterns = [
    # Catalogue
    path('', views.CourseListView.as_view(), name='course-list'),
    path('categories/', views.CategoryListView.as_view(), name='category-list'),
    path('search/', views.CourseSearchView.as_view(), name='course-search'),
    path('featured/', views.featured_courses, name='featured-courses'),
    path('trending/', views.trending_courses, name='trending-courses'),
    path('instructor/<uuid:instructor_id>/courses/', views.instructor_courses, name='instructor-courses'),

    # Espace formateur
    path('create/', views.CourseCreateView.as_view(), name='course-create'),
    path('mine/', views.InstructorCourseListView.as_view(), name='instructor-my-courses'),

    # Modules & leçons
    path('modules/<uuid:pk>/', views.ModuleDetailView.as_view(), name='module-detail'),
    path('modules/<uuid:module_id>/lessons/', views.LessonListView.as_view(), name='lesson-list'),
    path('modules/<uuid:module_id>/lessons/create/', views.LessonCreateView.as_view(), name='lesson-create'),
    path('lessons/<uuid:pk>/', views.LessonDetailView.as_view(), name='lesson-detail'),
    path('lessons/<uuid:pk>/video/', views.upload_lesson_video, name='lesson-video-upload'),
    path('lessons/<uuid:pk>/offline/', views.lesson_offline_package, name='lesson-offline'),
    path('media/<str:token>/<path:subpath>', views.lesson_media, name='lesson-media'),
    path('lessons/<uuid:lesson_id>/complete/', views.mark_lesson_completed, name='mark-lesson-completed'),
    path('lessons/<uuid:lesson_id>/quiz/', views.submit_quiz, name='submit-quiz'),

    # Inscriptions, favoris, certificats
    path('enrollments/', views.EnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/<uuid:pk>/', views.EnrollmentDetailView.as_view(), name='enrollment-detail'),
    path('favorites/', views.FavoriteListView.as_view(), name='favorite-list'),
    path('certificates/', views.MyCertificatesView.as_view(), name='certificate-list'),
    path('certificates/verify/<str:code>/', views.verify_certificate, name='certificate-verify'),
    path('reviews/<uuid:pk>/reply/', views.reply_to_review, name='review-reply'),

    # Routes par cours
    path('<slug:slug>/', views.CourseDetailView.as_view(), name='course-detail'),
    path('<slug:slug>/update/', views.CourseUpdateView.as_view(), name='course-update'),
    path('<slug:slug>/delete/', views.CourseDeleteView.as_view(), name='course-delete'),
    path('<slug:course_slug>/modules/', views.ModuleListView.as_view(), name='module-list'),
    path('<slug:course_slug>/modules/create/', views.ModuleCreateView.as_view(), name='module-create'),
    path('<slug:course_slug>/enroll/', views.EnrollmentCreateView.as_view(), name='enroll'),
    path('<slug:course_slug>/reviews/', views.CourseReviewListView.as_view(), name='review-list'),
    path('<slug:course_slug>/reviews/create/', views.CourseReviewCreateView.as_view(), name='review-create'),
    path('<slug:course_slug>/progress/', views.course_progress, name='course-progress'),
    path('<slug:course_slug>/favorite/', views.toggle_course_favorite, name='toggle-favorite'),
    path('<slug:course_slug>/analytics/', views.course_analytics, name='course-analytics'),
]
