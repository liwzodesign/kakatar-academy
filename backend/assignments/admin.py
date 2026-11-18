from django.contrib import admin

from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['lesson', 'user', 'status', 'grade', 'attempts', 'updated_at']
    list_filter = ['status']
    search_fields = ['user__email', 'lesson__title']
