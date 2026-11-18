from django.contrib import admin

from .models import LearningPath, PathCourse


class PathCourseInline(admin.TabularInline):
    model = PathCourse
    extra = 0
    autocomplete_fields = ['course']


@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    list_display = ['title', 'creator', 'price', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['title']
    inlines = [PathCourseInline]
