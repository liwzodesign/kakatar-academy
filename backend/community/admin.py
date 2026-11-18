from django.contrib import admin

from .models import Announcement, LessonComment


@admin.register(LessonComment)
class LessonCommentAdmin(admin.ModelAdmin):
    list_display = ['user', 'lesson', 'parent', 'is_resolved', 'is_hidden', 'created_at']
    list_filter = ['is_hidden', 'is_resolved']
    list_editable = ['is_hidden']
    search_fields = ['body', 'user__email', 'lesson__title']


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'author', 'recipients_count', 'created_at']
    search_fields = ['title', 'course__title']
