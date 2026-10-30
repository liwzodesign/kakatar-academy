from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid
from django.utils import timezone

from users.models import User

class Category(models.Model):
    """Catégorie de cours"""
    
    name = models.CharField(_('nom'), max_length=100, unique=True)
    slug = models.SlugField(_('slug'), max_length=100, unique=True)
    description = models.TextField(_('description'), blank=True)
    icon = models.CharField(_('icône'), max_length=50, blank=True)
    color = models.CharField(_('couleur'), max_length=7, default='#3B82F6')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        verbose_name=_('catégorie parente')
    )
    is_active = models.BooleanField(_('active'), default=True)
    order = models.PositiveIntegerField(_('ordre'), default=0)
    
    class Meta:
        verbose_name = _('catégorie')
        verbose_name_plural = _('catégories')
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name
    
    def get_full_path(self):
        """Retourne le chemin complet de la catégorie"""
        if self.parent:
            return f"{self.parent.get_full_path()} > {self.name}"
        return self.name

class Course(models.Model):
    """Modèle principal pour les cours"""
    
    # Statuts du cours
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PUBLISHED = 'PUBLISHED', _('Publié')
        ARCHIVED = 'ARCHIVED', _('Archivé')
        SCHEDULED = 'SCHEDULED', _('Programmé')
    
    # Niveaux de difficulté
    class Level(models.TextChoices):
        DEBUTANT = 'DEBUTANT', _('Débutant')
        INTERMEDIAIRE = 'INTERMEDIAIRE', _('Intermédiaire')
        AVANCE = 'AVANCE', _('Avancé')
    
    # Types de cours
    class Type(models.TextChoices):
        FREE = 'FREE', _('Gratuit')
        PAID = 'PAID', _('Payant')
        SUBSCRIPTION = 'SUBSCRIPTION', _('Abonnement')
    
    # ID unique
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Informations de base
    title = models.CharField(_('titre'), max_length=200)
    slug = models.SlugField(_('slug'), max_length=200, unique=True)
    subtitle = models.CharField(_('sous-titre'), max_length=300, blank=True)
    description = models.TextField(_('description'))
    short_description = models.CharField(_('description courte'), max_length=500, blank=True)
    
    # Métadonnées
    thumbnail = models.ImageField(_('miniature'), upload_to='courses/thumbnails/', blank=True)
    cover_image = models.ImageField(_('image de couverture'), upload_to='courses/covers/', blank=True)
    preview_video = models.URLField(_('vidéo de prévisualisation'), blank=True)
    
    # Classification
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='courses',
        verbose_name=_('catégorie')
    )
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.DEBUTANT,
        verbose_name=_('niveau')
    )
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.PAID,
        verbose_name=_('type')
    )
    
    # Contenu
    language = models.CharField(_('langue'), max_length=10, default='fr')
    tags = models.JSONField(_('tags'), blank=True, default=list)
    
    # Prix et monétisation
    price = models.DecimalField(
        _('prix'),
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    original_price = models.DecimalField(
        _('prix original'),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    currency = models.CharField(_('devise'), max_length=3, default='XOF')
    is_featured = models.BooleanField(_('mis en avant'), default=False)
    is_premium = models.BooleanField(_('premium'), default=False)
    
    # Statistiques
    duration = models.PositiveIntegerField(_('durée totale en minutes'), default=0)
    lessons_count = models.PositiveIntegerField(_('nombre de leçons'), default=0)
    students_count = models.PositiveIntegerField(_('nombre d\'étudiants'), default=0)
    rating_average = models.DecimalField(
        _('note moyenne'),
        max_digits=3,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    rating_count = models.PositiveIntegerField(_('nombre d\'évaluations'), default=0)
    completion_rate = models.DecimalField(
        _('taux de complétion'),
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    
    # Auteur et propriétaire
    instructor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='courses_created',
        verbose_name=_('instructeur')
    )
    co_instructors = models.ManyToManyField(
        User,
        related_name='courses_co_instructed',
        blank=True,
        verbose_name=_('co-instructeurs')
    )
    
    # Statut et publication
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('statut')
    )
    published_at = models.DateTimeField(_('date de publication'), null=True, blank=True)
    scheduled_at = models.DateTimeField(_('date de programmation'), null=True, blank=True)
    
    # Configuration
    allow_reviews = models.BooleanField(_('autoriser les avis'), default=True)
    allow_downloads = models.BooleanField(_('autoriser les téléchargements'), default=False)
    certificate_available = models.BooleanField(_('certificat disponible'), default=True)
    max_students = models.PositiveIntegerField(_('nombre maximum d\'étudiants'), null=True, blank=True)
    
    # SEO et marketing
    meta_title = models.CharField(_('titre SEO'), max_length=60, blank=True)
    meta_description = models.CharField(_('description SEO'), max_length=160, blank=True)
    keywords = models.JSONField(_('mots-clés SEO'), blank=True, default=list)
    
    # Métadonnées
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    
    class Meta:
        verbose_name = _('cours')
        verbose_name_plural = _('cours')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'published_at']),
            models.Index(fields=['category', 'level']),
            models.Index(fields=['instructor', 'status']),
            models.Index(fields=['price', 'type']),
        ]
    
    def __str__(self):
        return self.title
    
    def get_absolute_url(self):
        return f'/courses/{self.slug}/'
    
    def get_price_display(self):
        """Retourne le prix formaté avec la devise"""
        if self.price == 0:
            return 'Gratuit'
        return f"{self.price} {self.currency}"
    
    def get_discount_percentage(self):
        """Calcule le pourcentage de réduction"""
        if self.original_price and self.original_price > self.price:
            return int(((self.original_price - self.price) / self.original_price) * 100)
        return 0
    
    def is_published(self):
        """Vérifie si le cours est publié"""
        return self.status == self.Status.PUBLISHED
    
    def can_enroll(self):
        """Vérifie si le cours accepte de nouveaux étudiants"""
        if self.max_students is None:
            return True
        return self.students_count < self.max_students
    
    def is_free(self):
        return self.type == self.Type.FREE or self.price == 0

    def published_lessons(self):
        return Lesson.objects.filter(module__course=self, status=Lesson.Status.PUBLISHED)

    def update_stats(self):
        """Met à jour durée totale (minutes) et nombre de leçons publiées"""
        total_minutes = 0
        lessons_count = 0
        for lesson in self.published_lessons():
            total_minutes += lesson.get_minutes()
            lessons_count += 1
        self.duration = total_minutes
        self.lessons_count = lessons_count
        self.save(update_fields=['duration', 'lessons_count'])

    def update_rating(self):
        """Recalcule la note moyenne à partir des avis"""
        from django.db.models import Avg, Count
        agg = self.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        self.rating_average = round(agg['avg'] or 0, 2)
        self.rating_count = agg['count']
        self.save(update_fields=['rating_average', 'rating_count'])

    def update_students_count(self):
        self.students_count = self.enrollments.exclude(status='CANCELLED').count()
        self.save(update_fields=['students_count'])

class Module(models.Model):
    """Module d'un cours"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='modules',
        verbose_name=_('cours')
    )
    title = models.CharField(_('titre'), max_length=200)
    description = models.TextField(_('description'), blank=True)
    order = models.PositiveIntegerField(_('ordre'), default=0)
    is_free = models.BooleanField(_('gratuit'), default=False)
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('module')
        verbose_name_plural = _('modules')
        ordering = ['course', 'order']
        unique_together = ['course', 'order']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"
    
    def get_lessons_count(self):
        return self.lessons.count()
    
    def get_duration(self):
        return sum(lesson.get_minutes() for lesson in self.lessons.filter(status='PUBLISHED'))

class Lesson(models.Model):
    """Leçon d'un module"""
    
    # Types de leçons
    class Type(models.TextChoices):
        VIDEO = 'VIDEO', _('Vidéo')
        TEXT = 'TEXT', _('Texte')
        QUIZ = 'QUIZ', _('Quiz')
        PROJECT = 'PROJECT', _('Projet')
        RESOURCE = 'RESOURCE', _('Ressource')
        ASSIGNMENT = 'ASSIGNMENT', _('Devoir')
    
    # Statuts de la leçon
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PUBLISHED = 'PUBLISHED', _('Publiée')
        ARCHIVED = 'ARCHIVED', _('Archivée')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='lessons',
        verbose_name=_('module')
    )
    title = models.CharField(_('titre'), max_length=200)
    description = models.TextField(_('description'), blank=True)
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.VIDEO,
        verbose_name=_('type')
    )
    order = models.PositiveIntegerField(_('ordre'), default=0)
    
    # Contenu
    content = models.TextField(_('contenu'), blank=True)
    video_url = models.URLField(_('URL vidéo'), blank=True)
    video_duration = models.PositiveIntegerField(_('durée vidéo en secondes'), default=0)
    video_thumbnail = models.ImageField(_('miniature vidéo'), upload_to='lessons/thumbnails/', blank=True)
    
    # Ressources
    resources = models.JSONField(_('ressources'), default=list, blank=True)
    attachments = models.JSONField(_('pièces jointes'), default=list, blank=True)
    
    # Configuration
    is_free = models.BooleanField(_('gratuit'), default=False)
    is_required = models.BooleanField(_('obligatoire'), default=True)
    estimated_duration = models.PositiveIntegerField(_('durée estimée en minutes'), default=0)
    
    # Statut
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('statut')
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('leçon')
        verbose_name_plural = _('leçons')
        ordering = ['module', 'order']
        unique_together = ['module', 'order']
    
    def __str__(self):
        return f"{self.module.title} - {self.title}"
    
    def get_minutes(self):
        """Durée en minutes (vidéo si renseignée, sinon estimation)"""
        if self.video_duration:
            return max(1, round(self.video_duration / 60))
        return self.estimated_duration

    def get_duration_display(self):
        """Retourne la durée formatée"""
        if self.video_duration:
            minutes = self.video_duration // 60
            seconds = self.video_duration % 60
            return f"{minutes}:{seconds:02d}"
        return f"{self.estimated_duration} min"

class Enrollment(models.Model):
    """Inscription d'un étudiant à un cours"""
    
    # Statuts d'inscription
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Active')
        COMPLETED = 'COMPLETED', _('Terminée')
        CANCELLED = 'CANCELLED', _('Annulée')
        EXPIRED = 'EXPIRED', _('Expirée')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='enrollments',
        verbose_name=_('étudiant')
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments',
        verbose_name=_('cours')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name=_('statut')
    )
    
    # Progression
    progress = models.DecimalField(
        _('progression'),
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    completed_lessons = models.ManyToManyField(
        Lesson,
        related_name='completions',
        blank=True,
        verbose_name=_('leçons terminées')
    )
    current_lesson = models.ForeignKey(
        Lesson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_enrollments',
        verbose_name=_('leçon actuelle')
    )
    
    # Dates
    enrolled_at = models.DateTimeField(_('date d\'inscription'), auto_now_add=True)
    completed_at = models.DateTimeField(_('date de fin'), null=True, blank=True)
    last_accessed = models.DateTimeField(_('dernier accès'), auto_now=True)
    
    # Certificat
    certificate_code = models.CharField(_('code du certificat'), max_length=20, blank=True, db_index=True)
    certificate_issued = models.BooleanField(_('certificat délivré'), default=False)
    certificate_issued_at = models.DateTimeField(_('date de délivrance du certificat'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('inscription')
        verbose_name_plural = _('inscriptions')
        unique_together = ['user', 'course']
        ordering = ['-enrolled_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.course.title}"
    
    def has_access(self):
        return self.status in (self.Status.ACTIVE, self.Status.COMPLETED)

    def update_progress(self):
        """Recalcule la progression sur les leçons publiées ; délivre le certificat à 100 %"""
        published = self.course.published_lessons()
        total = published.count()
        if total == 0:
            return
        done = self.completed_lessons.filter(id__in=published.values('id')).count()
        self.progress = round(done * 100 / total, 2)
        fields = ['progress']
        if done >= total and self.status == self.Status.ACTIVE:
            self.status = self.Status.COMPLETED
            self.completed_at = timezone.now()
            fields += ['status', 'completed_at']
            if self.course.certificate_available and not self.certificate_issued:
                self.issue_certificate(save=False)
                fields += ['certificate_issued', 'certificate_issued_at', 'certificate_code']
        self.save(update_fields=fields)

    def issue_certificate(self, save=True):
        import secrets
        self.certificate_issued = True
        self.certificate_issued_at = timezone.now()
        if not self.certificate_code:
            self.certificate_code = 'KA-' + secrets.token_hex(5).upper()
        if save:
            self.save(update_fields=['certificate_issued', 'certificate_issued_at', 'certificate_code'])

class CourseReview(models.Model):
    """Avis sur un cours"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='course_reviews',
        verbose_name=_('utilisateur')
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name=_('cours')
    )
    
    # Évaluation
    rating = models.PositiveIntegerField(
        _('note'),
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(_('titre'), max_length=200, blank=True)
    comment = models.TextField(_('commentaire'), blank=True)
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_verified = models.BooleanField(_('vérifié'), default=False)
    
    class Meta:
        verbose_name = _('avis de cours')
        verbose_name_plural = _('avis de cours')
        unique_together = ['user', 'course']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.course.title} ({self.rating}/5)"
    
    def save(self, *args, **kwargs):
        """Sauvegarde et met à jour la note moyenne du cours"""
        is_new = self._state.adding
        super().save(*args, **kwargs)
        self.course.update_rating()
        if is_new:
            self.course.instructor.update_rating(self.rating) 