from django.contrib import admin

from .models import LiveSession, SessionRegistration


class RegistrationInline(admin.TabularInline):
    model = SessionRegistration
    extra = 0
    fields = ['user', 'status', 'phone', 'company', 'created_at']
    readonly_fields = ['created_at']


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'instructor', 'type', 'start_at', 'capacity', 'price', 'status']
    list_filter = ['type', 'status', 'level']
    search_fields = ['title', 'instructor__email']
    inlines = [RegistrationInline]


@admin.register(SessionRegistration)
class SessionRegistrationAdmin(admin.ModelAdmin):
    list_display = ['session', 'user', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['user__email', 'session__title']
