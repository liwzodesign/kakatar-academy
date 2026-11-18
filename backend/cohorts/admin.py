from django.contrib import admin

from .models import Cohort, CohortMembership


class MembershipInline(admin.TabularInline):
    model = CohortMembership
    extra = 0
    fields = ['user', 'status', 'created_at']
    readonly_fields = ['created_at']


@admin.register(Cohort)
class CohortAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'start_date', 'end_date', 'capacity', 'price', 'status']
    list_filter = ['status']
    search_fields = ['title', 'course__title']
    inlines = [MembershipInline]
