from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _
import uuid

class User(AbstractUser):
    """
    Modèle utilisateur personnalisé pour Kakatar Academy
    """
    
    # Rôles utilisateur
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', _('Administrateur')
        FORMATEUR = 'FORMATEUR', _('Formateur')
        ETUDIANT = 'ETUDIANT', _('Étudiant')
        MODERATEUR = 'MODERATEUR', _('Modérateur')
        PARTENAIRE = 'PARTENAIRE', _('Partenaire')
    
    # Statuts de vérification
    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', _('En attente')
        VERIFIED = 'VERIFIED', _('Vérifié')
        REJECTED = 'REJECTED', _('Rejeté')
    
    # ID unique
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Informations de base
    email = models.EmailField(_('adresse email'), unique=True)
    username = models.CharField(_('nom d\'utilisateur'), max_length=150, unique=True, blank=True)
    first_name = models.CharField(_('prénom'), max_length=150)
    last_name = models.CharField(_('nom'), max_length=150)
    
    # Rôle et statut
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ETUDIANT,
        verbose_name=_('rôle')
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        verbose_name=_('statut de vérification')
    )
    
    # Profil et bio
    bio = models.TextField(_('biographie'), max_length=500, blank=True)
    avatar = models.ImageField(_('avatar'), upload_to='avatars/', blank=True, null=True)
    cover_image = models.ImageField(_('image de couverture'), upload_to='covers/', blank=True, null=True)
    
    # Informations de contact
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Le numéro de téléphone doit être au format: '+999999999'. Jusqu'à 15 chiffres autorisés."
    )
    phone_number = models.CharField(
        validators=[phone_regex],
        max_length=17,
        blank=True,
        verbose_name=_('numéro de téléphone')
    )
    
    # Localisation
    country = models.CharField(_('pays'), max_length=100, blank=True)
    city = models.CharField(_('ville'), max_length=100, blank=True)
    timezone = models.CharField(_('fuseau horaire'), max_length=50, default='Africa/Abidjan')
    
    # Préférences
    language = models.CharField(_('langue'), max_length=10, default='fr')
    email_notifications = models.BooleanField(_('notifications par email'), default=True)
    push_notifications = models.BooleanField(_('notifications push'), default=True)
    
    # Informations professionnelles (pour formateurs)
    company = models.CharField(_('entreprise'), max_length=200, blank=True)
    website = models.URLField(_('site web'), blank=True)
    linkedin = models.URLField(_('LinkedIn'), blank=True)
    twitter = models.URLField(_('Twitter'), blank=True)
    
    # Statistiques
    total_courses_created = models.PositiveIntegerField(_('total des cours créés'), default=0)
    total_students = models.PositiveIntegerField(_('total des étudiants'), default=0)
    total_revenue = models.DecimalField(_('revenus totaux'), max_digits=10, decimal_places=2, default=0)
    rating_average = models.DecimalField(_('note moyenne'), max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(_('nombre d\'évaluations'), default=0)
    
    # Sécurité et conformité
    is_verified = models.BooleanField(_('vérifié'), default=False)
    two_factor_enabled = models.BooleanField(_('authentification à deux facteurs'), default=False)
    last_login_ip = models.GenericIPAddressField(_('dernière IP de connexion'), blank=True, null=True)
    
    # Métadonnées
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    last_activity = models.DateTimeField(_('dernière activité'), auto_now=True)
    
    # Champs Django par défaut
    is_active = models.BooleanField(_('actif'), default=True)
    is_staff = models.BooleanField(_('membre du staff'), default=False)
    date_joined = models.DateTimeField(_('date d\'inscription'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('utilisateur')
        verbose_name_plural = _('utilisateurs')
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['verification_status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    def get_full_name(self):
        """Retourne le nom complet de l'utilisateur"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.username:
            return self.username
        return self.email
    
    def get_short_name(self):
        """Retourne le prénom de l'utilisateur"""
        return self.first_name or self.username or self.email
    
    def is_formateur(self):
        """Vérifie si l'utilisateur est un formateur"""
        return self.role in [self.Role.FORMATEUR, self.Role.ADMIN]
    
    def is_admin(self):
        """Vérifie si l'utilisateur est un administrateur"""
        return self.role == self.Role.ADMIN
    
    def can_create_courses(self):
        """Vérifie si l'utilisateur peut créer des cours"""
        return self.is_formateur() and self.verification_status == self.VerificationStatus.VERIFIED
    
    def get_avatar_url(self):
        """Retourne l'URL de l'avatar ou une image par défaut"""
        if self.avatar:
            return self.avatar.url
        return f"https://ui-avatars.com/api/?name={self.get_full_name()}&background=random"
    
    def update_rating(self, new_rating):
        """Met à jour la note moyenne de l'utilisateur"""
        if self.rating_count == 0:
            self.rating_average = new_rating
        else:
            total_rating = (self.rating_average * self.rating_count) + new_rating
            self.rating_count += 1
            self.rating_average = total_rating / self.rating_count
        self.save(update_fields=['rating_average', 'rating_count'])

class UserProfile(models.Model):
    """
    Profil étendu pour les informations supplémentaires
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    # Compétences et expertise
    skills = models.JSONField(_('compétences'), default=list, blank=True)
    certifications = models.JSONField(_('certifications'), default=list, blank=True)
    experience_years = models.PositiveIntegerField(_('années d\'expérience'), default=0)
    
    # Préférences d'apprentissage
    learning_goals = models.JSONField(_('objectifs d\'apprentissage'), default=list, blank=True)
    preferred_categories = models.JSONField(_('catégories préférées'), default=list, blank=True)
    
    # Statistiques d'apprentissage
    courses_completed = models.PositiveIntegerField(_('cours terminés'), default=0)
    total_study_time = models.PositiveIntegerField(_('temps d\'étude total en minutes'), default=0)
    current_streak = models.PositiveIntegerField(_('série actuelle de jours'), default=0)
    longest_streak = models.PositiveIntegerField(_('plus longue série'), default=0)
    
    # Réseau social
    followers = models.ManyToManyField(
        User,
        related_name='following',
        blank=True,
        verbose_name=_('abonnés')
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('profil utilisateur')
        verbose_name_plural = _('profils utilisateurs')
    
    def __str__(self):
        return f"Profil de {self.user.get_full_name()}"
    
    def get_followers_count(self):
        return self.followers.count()
    
    def get_following_count(self):
        return self.user.following.count()

class UserVerification(models.Model):
    """
    Modèle pour la vérification des comptes formateurs
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='verification')
    
    # Documents de vérification
    id_document = models.FileField(_('document d\'identité'), upload_to='verification/id_documents/')
    professional_cv = models.FileField(_('CV professionnel'), upload_to='verification/cv/')
    portfolio_url = models.URLField(_('URL du portfolio'), blank=True)
    
    # Informations de vérification
    verification_notes = models.TextField(_('notes de vérification'), blank=True)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verifications_processed'
    )
    verified_at = models.DateTimeField(_('date de vérification'), null=True, blank=True)
    
    # Statut
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('UNDER_REVIEW', 'En cours d\'examen'),
        ('APPROVED', 'Approuvé'),
        ('REJECTED', 'Rejeté'),
        ('NEEDS_MORE_INFO', 'Informations supplémentaires requises'),
    ]
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('vérification utilisateur')
        verbose_name_plural = _('vérifications utilisateurs')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Vérification de {self.user.get_full_name()} - {self.get_status_display()}" 