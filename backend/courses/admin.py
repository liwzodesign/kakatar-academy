from django.contrib import admin

from .models import (
    Category, Certificate, Course, CourseFavorite, CourseReview, Enrollment, Lesson, Module, QuizAttempt,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'parent', 'is_active', 'order']
    list_editable = ['is_active', 'order']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name']


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0
    fields = ['title', 'order', 'is_free']


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'instructor', 'category', 'status', 'price', 'students_count', 'rating_average',
                    'is_featured', 'published_at']
    list_filter = ['status', 'level', 'type', 'is_featured', 'category']
    list_editable = ['is_featured']
    search_fields = ['title', 'instructor__email', 'instructor__last_name']
    readonly_fields = ['students_count', 'rating_average', 'rating_count', 'completion_rate', 'duration',
                       'lessons_count', 'created_at', 'updated_at']
    prepopulated_fields = {'slug': ('title',)}
    autocomplete_fields = ['instructor']
    inlines = [ModuleInline]
    actions = ['publish', 'archive']

    @admin.action(description='Publier les cours sélectionnés')
    def publish(self, request, queryset):
        for course in queryset:
            course.status = Course.Status.PUBLISHED
            course.save()

    @admin.action(description='Archiver les cours sélectionnés')
    def archive(self, request, queryset):
        queryset.update(status=Course.Status.ARCHIVED)


class LessonInline(admin.StackedInline):
    model = Lesson
    extra = 0
    fields = ['title', 'type', 'order', 'status', 'is_free', 'video_url', 'video_status', 'estimated_duration']
    readonly_fields = ['video_status']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'order', 'is_free']
    search_fields = ['title', 'course__title']
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'type', 'status', 'video_status', 'order']
    list_filter = ['type', 'status', 'video_status']
    search_fields = ['title', 'module__course__title']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'course', 'status', 'progress', 'enrolled_at', 'certificate_issued']
    list_filter = ['status', 'certificate_issued']
    search_fields = ['user__email', 'course__title']


@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = ['course', 'user', 'rating', 'is_hidden', 'created_at']
    list_filter = ['rating', 'is_hidden']
    list_editable = ['is_hidden']
    search_fields = ['course__title', 'user__email', 'comment']


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ['code', 'enrollment', 'issued_at']
    search_fields = ['code', 'enrollment__user__email']


admin.site.register(CourseFavorite)
admin.site.register(QuizAttempt)
