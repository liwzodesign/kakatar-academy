from django.contrib import admin

from .models import Category, Course, CourseReview, Enrollment, Lesson, Module


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'parent', 'order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0
    fields = ['order', 'title', 'is_free']


class LessonInline(admin.StackedInline):
    model = Lesson
    extra = 0
    fields = ['order', 'title', 'type', 'status', 'is_free', 'estimated_duration', 'video_url', 'content']


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'instructor', 'category', 'type', 'price', 'status',
                    'lessons_count', 'students_count', 'is_featured']
    list_filter = ['status', 'type', 'level', 'category', 'is_featured']
    search_fields = ['title', 'instructor__email']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['duration', 'lessons_count', 'students_count', 'rating_average', 'rating_count']
    inlines = [ModuleInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'order']
    list_filter = ['course']
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'order', 'type', 'status', 'is_free']
    list_filter = ['status', 'type', 'module__course']
    search_fields = ['title']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'course', 'status', 'progress', 'certificate_code', 'enrolled_at']
    list_filter = ['status', 'course', 'certificate_issued']
    search_fields = ['user__email', 'certificate_code']
    filter_horizontal = ['completed_lessons']


@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = ['course', 'user', 'rating', 'is_verified', 'created_at']
    list_filter = ['is_verified', 'rating']
