from django.contrib import admin

from .models import DailySnapshot


@admin.register(DailySnapshot)
class DailySnapshotAdmin(admin.ModelAdmin):
    list_display = ['date', 'total_users', 'new_users', 'active_users', 'new_enrollments', 'completions', 'revenue']
    date_hierarchy = 'date'
