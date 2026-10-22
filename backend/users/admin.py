from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

from .models import User, UserProfile, UserVerification

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Administration des utilisateurs personnalisée"""
    
    list_display = [
        'email', 'get_full_name', 'role', 'verification_status', 
        'is_verified', 'is_active', 'date_joined', 'last_activity'
    ]
    list_filter = [
        'role', 'verification_status', 'is_verified', 'is_active',
        'two_factor_enabled', 'country', 'date_joined'
    ]
    search_fields = ['email', 'first_name', 'last_name', 'username']
    ordering = ['-date_joined']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_activity']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Informations personnelles'), {
            'fields': ('username', 'first_name', 'last_name', 'bio', 'avatar', 'cover_image')
        }),
        (_('Rôle et statut'), {
            'fields': ('role', 'verification_status', 'is_verified', 'is_active', 'is_staff')
        }),
        (_('Contact'), {
            'fields': ('phone_number', 'country', 'city', 'timezone')
        }),
        (_('Professionnel'), {
            'fields': ('company', 'website', 'linkedin', 'twitter'),
            'classes': ('collapse',)
        }),
        (_('Statistiques'), {
            'fields': ('total_courses_created', 'total_students', 'total_revenue', 
                      'rating_average', 'rating_count'),
            'classes': ('collapse',)
        }),
        (_('Sécurité'), {
            'fields': ('two_factor_enabled', 'last_login_ip'),
            'classes': ('collapse',)
        }),
        (_('Métadonnées'), {
            'fields': ('id', 'created_at', 'updated_at', 'last_activity', 'date_joined'),
            'classes': ('collapse',)
        }),
        (_('Permissions'), {
            'fields': ('groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'first_name', 'last_name'),
        }),
    )
    
    def get_full_name(self, obj):
        return obj.get_full_name()
    get_full_name.short_description = _('Nom complet')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('profile')
    
    def verification_link(self, obj):
        if hasattr(obj, 'verification'):
            url = reverse('admin:users_userverification_change', args=[obj.verification.id])
            return format_html('<a href="{}">Voir la vérification</a>', url)
        return '-'
    verification_link.short_description = _('Vérification')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Administration des profils utilisateurs"""
    
    list_display = [
        'user', 'experience_years', 'courses_completed', 
        'total_study_time', 'current_streak', 'longest_streak'
    ]
    list_filter = ['experience_years', 'courses_completed']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        (None, {'fields': ('user',)}),
        (_('Compétences'), {
            'fields': ('skills', 'certifications', 'experience_years')
        }),
        (_('Apprentissage'), {
            'fields': ('learning_goals', 'preferred_categories')
        }),
        (_('Statistiques'), {
            'fields': ('courses_completed', 'total_study_time', 'current_streak', 'longest_streak')
        }),
        (_('Réseau social'), {
            'fields': ('followers',)
        }),
        (_('Métadonnées'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

@admin.register(UserVerification)
class UserVerificationAdmin(admin.ModelAdmin):
    """Administration des vérifications de comptes formateurs"""
    
    list_display = [
        'user', 'status', 'verified_by', 'created_at', 'verified_at'
    ]
    list_filter = ['status', 'created_at', 'verified_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        (None, {'fields': ('user', 'status')}),
        (_('Documents'), {
            'fields': ('id_document', 'professional_cv', 'portfolio_url')
        }),
        (_('Vérification'), {
            'fields': ('verification_notes', 'verified_by', 'verified_at')
        }),
        (_('Métadonnées'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'verified_by')
    
    def save_model(self, request, obj, form, change):
        if change and 'status' in form.changed_data:
            # Mettre à jour le statut de l'utilisateur si la vérification est approuvée
            if obj.status == 'APPROVED':
                user = obj.user
                user.verification_status = 'VERIFIED'
                user.is_verified = True
                user.save(update_fields=['verification_status', 'is_verified'])
                
                # Enregistrer qui a approuvé
                if not obj.verified_by:
                    obj.verified_by = request.user
                obj.verified_at = timezone.now()
        
        super().save_model(request, obj, form, change)

# Personnalisation de l'interface d'administration
admin.site.site_header = _('Administration Kakatar Academy')
admin.site.site_title = _('Kakatar Academy Admin')
admin.site.index_title = _('Tableau de bord')

# Actions personnalisées
@admin.action(description=_('Approuver les vérifications sélectionnées'))
def approve_verifications(modeladmin, request, queryset):
    for verification in queryset:
        verification.status = 'APPROVED'
        verification.verified_by = request.user
        verification.verified_at = timezone.now()
        verification.save()
        
        # Mettre à jour l'utilisateur
        user = verification.user
        user.verification_status = 'VERIFIED'
        user.is_verified = True
        user.save(update_fields=['verification_status', 'is_verified'])

@admin.action(description=_('Rejeter les vérifications sélectionnées'))
def reject_verifications(modeladmin, request, queryset):
    for verification in queryset:
        verification.status = 'REJECTED'
        verification.verified_by = request.user
        verification.verified_at = timezone.now()
        verification.save()

# Ajouter les actions aux modèles
UserVerificationAdmin.actions = [approve_verifications, reject_verifications] 