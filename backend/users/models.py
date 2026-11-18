from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.core.validators import RegexValidator
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
import uuid


class UserManager(BaseUserManager):
    """Manager : l'email sert d'identifiant ; le username est généré s'il est absent."""

    use_in_migrations = True

    def _unique_username(self, base):
        base = slugify(base)[:140] or 'user'
        candidate, i = base, 1
        while self.model.objects.filter(username=candidate).exists():
            i += 1
            candidate = f"{base}-{i}"
        return candidate

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire")
        email = self.normalize_email(email).lower()
        if not extra_fields.get('username'):
            extra_fields['username'] = self._unique_username(email.split('@')[0])
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('verification_status', 'VERIFIED')
        extra_fields.setdefault('is_verified', True)
        if not extra_fields.get('is_staff') or not extra_fields.get('is_superuser'):
            raise ValueError('Un superutilisateur doit avoir is_staff=True et is_superuser=True.')
        return self._create_user(email, password, **extra_fields)


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
    totp_secret = models.CharField(_('secret TOTP'), max_length=64, blank=True)
    is_banned = models.BooleanField(_('banni'), default=False)

    # Parrainage
    referral_code = models.CharField(_('code de parrainage'), max_length=12, unique=True, null=True, blank=True)
    referred_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals',
                                    verbose_name=_('parrain'))
    referral_rewarded = models.BooleanField(_('récompense de parrainage versée'), default=False)
    last_login_ip = models.GenericIPAddressField(_('dernière IP de connexion'), blank=True, null=True)
    
    # Métadonnées
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    last_activity = models.DateTimeField(_('dernière activité'), auto_now=True)
    
    # Champs Django par défaut
    is_active = models.BooleanField(_('actif'), default=True)
    is_staff = models.BooleanField(_('membre du staff'), default=False)
    date_joined = models.DateTimeField(_('date d\'inscription'), auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

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
    
    def ensure_referral_code(self):
        """Code de parrainage court et lisible (sans 0/O/1/I), généré à la demande."""
        if not self.referral_code:
            import secrets
            alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            while True:
                code = ''.join(secrets.choice(alphabet) for _ in range(7))
                if not User.objects.filter(referral_code=code).exists():
                    break
            self.referral_code = code
            self.save(update_fields=['referral_code'])
        return self.referral_code

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = User.objects._unique_username((self.email or 'user').split('@')[0])
        super().save(*args, **kwargs)

    def update_rating(self, new_rating=None):
        """Recalcule la note moyenne du formateur à partir des avis de ses cours."""
        from django.db.models import Avg, Count
        from courses.models import CourseReview

        agg = CourseReview.objects.filter(course__instructor=self).aggregate(avg=Avg('rating'), count=Count('id'))
        self.rating_average = round(agg['avg'] or 0, 2)
        self.rating_count = agg['count'] or 0
        self.save(update_fields=['rating_average', 'rating_count'])

    def refresh_instructor_stats(self):
        """Recalcule les statistiques agrégées du formateur."""
        from django.db.models import Sum
        from courses.models import Course, Enrollment

        courses = Course.objects.filter(instructor=self).exclude(status=Course.Status.ARCHIVED)
        self.total_courses_created = courses.count()
        self.total_students = Enrollment.objects.filter(course__instructor=self).values('user').distinct().count()
        try:
            from payments.models import Commission
            self.total_revenue = Commission.objects.filter(instructor=self).aggregate(
                s=Sum('instructor_amount'))['s'] or 0
        except Exception:  # pragma: no cover
            pass
        self.save(update_fields=['total_courses_created', 'total_students', 'total_revenue'])

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

    # Objectif quotidien et rappel
    daily_goal_minutes = models.PositiveIntegerField(_('objectif quotidien (minutes)'), default=15)
    reminder_enabled = models.BooleanField(_('rappel quotidien'), default=True)
    reminder_hour = models.PositiveSmallIntegerField(_('heure du rappel'), default=19)

    # Profil public (portfolio) et classement — le profil public est désactivé par défaut
    public_profile = models.BooleanField(_('profil public'), default=False)
    public_handle = models.SlugField(_('adresse du profil public'), max_length=40, unique=True, null=True, blank=True)
    headline = models.CharField(_('titre'), max_length=120, blank=True)
    show_in_leaderboard = models.BooleanField(_('apparaître dans la ligue'), default=True)
    
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