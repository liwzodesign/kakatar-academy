from django.contrib import admin

from .models import AIRequestLog


@admin.register(AIRequestLog)
class AIRequestLogAdmin(admin.ModelAdmin):
    list_display = ['feature', 'user', 'success', 'used_llm', 'created_at']
    list_filter = ['feature', 'success', 'used_llm']
