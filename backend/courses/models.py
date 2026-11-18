import secrets
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count, Max
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from users.models import User


def _unique_slug(model, value, max_length, instance_pk=None, fallback='item'):
    base = slugify(value)[: max_length - 6] or fallback
    slug, i = base, 1
    while model.objects.filter(slug=slug).exclude(pk=instance_pk).exists():
        i += 1
        slug = f"{base}-{i}"
    return slug


class Category(models.Model):
    """Catégorie de cours"""

    name = models.CharField(_('nom'), max_length=100, unique=True)
    slug = models.SlugField(_('slug'), max_length=100, unique=True, blank=True)
    description = models.TextField(_('description'), blank=True)
    icon = models.CharField(_('icône'), max_length=50, blank=True)
    color = models.CharField(_('couleur'), max_length=7, default='#3B82F6')
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children', verbose_name=_('catégorie parente'),
    )
    is_active = models.BooleanField(_('active'), default=True)
    order = models.PositiveIntegerField(_('ordre'), default=0)

    class Meta:
        verbose_name = _('catégorie')
        verbose_name_plural = _('catégories')
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(Category, self.name, 100, self.pk, 'categorie')
        super().save(*args, **kwargs)

    def get_full_path(self):
        if self.parent:
            return f"{self.parent.get_full_path()} > {self.name}"
        return self.name


class Course(models.Model):
    """Modèle principal pour les cours"""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PENDING_REVIEW = 'PENDING_REVIEW', _('En attente de validation')
        PUBLISHED = 'PUBLISHED', _('Publié')
        ARCHIVED = 'ARCHIVED', _('Archivé')
        SCHEDULED = 'SCHEDULED', _('Programmé')

    class Level(models.TextChoices):
        DEBUTANT = 'DEBUTANT', _('Débutant')
        INTERMEDIAIRE = 'INTERMEDIAIRE', _('Intermédiaire')
        AVANCE = 'AVANCE', _('Avancé')

    class Type(models.TextChoices):
        FREE = 'FREE', _('Gratuit')
        PAID = 'PAID', _('Payant')
        SUBSCRIPTION = 'SUBSCRIPTION', _('Abonnement')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Informations de base
    title = models.CharField(_('titre'), max_length=200)
    slug = models.SlugField(_('slug'), max_length=200, unique=True, blank=True)
    subtitle = models.CharField(_('sous-titre'), max_length=300, blank=True)
    description = models.TextField(_('description'))
    short_description = models.CharField(_('description courte'), max_length=500, blank=True)
    objectives = models.JSONField(_('objectifs pédagogiques'), default=list, blank=True)
    requirements = models.JSONField(_('prérequis'), default=list, blank=True)

    # Visuels
    thumbnail = models.ImageField(_('miniature'), upload_to='courses/thumbnails/', blank=True)
    thumbnail_url = models.URLField(_('URL de miniature externe'), blank=True)
    cover_image = models.ImageField(_('image de couverture'), upload_to='courses/covers/', blank=True)
    preview_video = models.URLField(_('vidéo de prévisualisation'), blank=True)

    # Classification
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='courses',
                                 verbose_name=_('catégorie'))
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.DEBUTANT,
                             verbose_name=_('niveau'))
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.PAID, verbose_name=_('type'))
    language = models.CharField(_('langue'), max_length=10, default='fr')
    tags = models.JSONField(_('tags'), blank=True, default=list)

    # Prix
    price = models.DecimalField(_('prix'), max_digits=10, decimal_places=2, default=0,
                                validators=[MinValueValidator(0)])
    original_price = models.DecimalField(_('prix original'), max_digits=10, decimal_places=2,
                                         null=True, blank=True)
    currency = models.CharField(_('devise'), max_length=3, default='XOF')
    is_featured = models.BooleanField(_('mis en avant'), default=False)
    is_premium = models.BooleanField(_('premium'), default=False)

    # Statistiques (dénormalisées)
    duration = models.PositiveIntegerField(_('durée totale en minutes'), default=0)
    lessons_count = models.PositiveIntegerField(_('nombre de leçons'), default=0)
    students_count = models.PositiveIntegerField(_("nombre d'étudiants"), default=0)
    rating_average = models.DecimalField(_('note moyenne'), max_digits=3, decimal_places=2, default=0,
                                         validators=[MinValueValidator(0), MaxValueValidator(5)])
    rating_count = models.PositiveIntegerField(_("nombre d'évaluations"), default=0)
    completion_rate = models.DecimalField(_('taux de complétion'), max_digits=5, decimal_places=2, default=0,
                                          validators=[MinValueValidator(0), MaxValueValidator(100)])

    # Auteurs
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses_created',
                                   verbose_name=_('instructeur'))
    co_instructors = models.ManyToManyField(User, related_name='courses_co_instructed', blank=True,
                                            verbose_name=_('co-instructeurs'))

    # Publication
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT,
                              verbose_name=_('statut'))
    published_at = models.DateTimeField(_('date de publication'), null=True, blank=True)
    scheduled_at = models.DateTimeField(_('date de programmation'), null=True, blank=True)

    # Configuration
    allow_reviews = models.BooleanField(_('autoriser les avis'), default=True)
    allow_downloads = models.BooleanField(_('autoriser les téléchargements'), default=False)
    certificate_available = models.BooleanField(_('certificat disponible'), default=True)
    max_students = models.PositiveIntegerField(_("nombre maximum d'étudiants"), null=True, blank=True)

    # SEO
    meta_title = models.CharField(_('titre SEO'), max_length=60, blank=True)
    meta_description = models.CharField(_('description SEO'), max_length=160, blank=True)
    keywords = models.JSONField(_('mots-clés SEO'), blank=True, default=list)

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

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(Course, self.title, 200, self.pk, 'cours')
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        if self.price == 0 and self.type == self.Type.PAID:
            self.type = self.Type.FREE
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return f'/courses/{self.slug}/'

    def get_thumbnail_url(self):
        if self.thumbnail:
            return self.thumbnail.url
        return self.thumbnail_url or ''

    def get_price_display(self):
        if self.price == 0:
            return 'Gratuit'
        return f"{self.price:,.0f} {self.currency}".replace(',', ' ')

    def get_discount_percentage(self):
        if self.original_price and self.original_price > self.price:
            return int(((self.original_price - self.price) / self.original_price) * 100)
        return 0

    def is_free(self):
        return self.price == 0 or self.type == self.Type.FREE

    def is_published(self):
        return self.status == self.Status.PUBLISHED

    def can_enroll(self):
        if self.max_students is None:
            return True
        return self.students_count < self.max_students

    def update_stats(self):
        """Recalcule la durée totale et le nombre de leçons publiées."""
        lessons = Lesson.objects.filter(module__course=self, status=Lesson.Status.PUBLISHED)
        self.duration = sum(lesson.get_minutes() for lesson in lessons)
        self.lessons_count = lessons.count()
        self.save(update_fields=['duration', 'lessons_count'])

    def update_rating(self):
        agg = self.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        self.rating_average = round(agg['avg'] or 0, 2)
        self.rating_count = agg['count'] or 0
        self.save(update_fields=['rating_average', 'rating_count'])

    def update_enrollment_stats(self):
        enrollments = self.enrollments.exclude(status=Enrollment.Status.CANCELLED)
        total = enrollments.count()
        completed = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
        self.students_count = total
        self.completion_rate = round(completed * 100 / total, 2) if total else 0
        self.save(update_fields=['students_count', 'completion_rate'])


class Module(models.Model):
    """Module (chapitre) d'un cours"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules', verbose_name=_('cours'))
    title = models.CharField(_('titre'), max_length=200)
    description = models.TextField(_('description'), blank=True)
    order = models.PositiveIntegerField(_('ordre'), default=0)
    is_free = models.BooleanField(_('gratuit'), default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('module')
        verbose_name_plural = _('modules')
        ordering = ['course', 'order']

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    def save(self, *args, **kwargs):
        if self._state.adding and not self.order:
            last = Module.objects.filter(course=self.course).aggregate(m=Max('order'))['m']
            self.order = (last or 0) + 1
        super().save(*args, **kwargs)

    def get_lessons_count(self):
        return self.lessons.count()

    def get_duration(self):
        return sum(lesson.get_minutes() for lesson in self.lessons.all())


class Lesson(models.Model):
    """Leçon d'un module"""

    class Type(models.TextChoices):
        VIDEO = 'VIDEO', _('Vidéo')
        TEXT = 'TEXT', _('Texte')
        QUIZ = 'QUIZ', _('Quiz')
        PROJECT = 'PROJECT', _('Projet')
        RESOURCE = 'RESOURCE', _('Ressource')
        ASSIGNMENT = 'ASSIGNMENT', _('Devoir')

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PUBLISHED = 'PUBLISHED', _('Publiée')
        ARCHIVED = 'ARCHIVED', _('Archivée')

    class VideoStatus(models.TextChoices):
        NONE = 'NONE', _('Aucune')
        UPLOADED = 'UPLOADED', _('Téléversée')
        PROCESSING = 'PROCESSING', _('En traitement')
        READY = 'READY', _('Prête')
        FAILED = 'FAILED', _('Échec')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons', verbose_name=_('module'))
    title = models.CharField(_('titre'), max_length=200)
    description = models.TextField(_('description'), blank=True)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.VIDEO, verbose_name=_('type'))
    order = models.PositiveIntegerField(_('ordre'), default=0)

    # Contenu
    content = models.TextField(_('contenu'), blank=True)
    video_url = models.URLField(_('URL vidéo externe'), blank=True)
    video_duration = models.PositiveIntegerField(_('durée vidéo en secondes'), default=0)
    video_thumbnail = models.ImageField(_('miniature vidéo'), upload_to='lessons/thumbnails/', blank=True)

    # Vidéo hébergée + streaming HLS
    video_file = models.FileField(_('fichier vidéo'), upload_to='lessons/videos/', blank=True)
    hls_playlist = models.CharField(_('playlist HLS'), max_length=500, blank=True)
    video_status = models.CharField(max_length=20, choices=VideoStatus.choices, default=VideoStatus.NONE)
    subtitles = models.TextField(_('sous-titres (WebVTT)'), blank=True)
    summary = models.TextField(_('résumé'), blank=True)

    # Quiz : liste de {question, options: [...], answer: index, explanation}
    quiz = models.JSONField(_('questions du quiz'), default=list, blank=True)
    passing_score = models.PositiveIntegerField(_('score de réussite (%)'), default=70)

    # Ressources
    resources = models.JSONField(_('ressources'), default=list, blank=True)
    attachments = models.JSONField(_('pièces jointes'), default=list, blank=True)

    # Configuration
    is_free = models.BooleanField(_('aperçu gratuit'), default=False)
    is_required = models.BooleanField(_('obligatoire'), default=True)
    estimated_duration = models.PositiveIntegerField(_('durée estimée en minutes'), default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED,
                              verbose_name=_('statut'))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('leçon')
        verbose_name_plural = _('leçons')
        ordering = ['module', 'order']

    def __str__(self):
        return f"{self.module.title} - {self.title}"

    def save(self, *args, **kwargs):
        if self._state.adding and not self.order:
            last = Lesson.objects.filter(module=self.module).aggregate(m=Max('order'))['m']
            self.order = (last or 0) + 1
        super().save(*args, **kwargs)

    @property
    def course(self):
        return self.module.course

    def get_minutes(self):
        if self.video_duration:
            return max(1, round(self.video_duration / 60))
        return self.estimated_duration

    def get_video_url(self, user=None):
        """
        URL de lecture pour cet utilisateur : lien signé et temporaire pour une vidéo hébergée
        (HLS si prête, sinon MP4), sinon l'URL externe (YouTube, Vimeo…).
        """
        if self.video_file:
            from .media import playback_path
            return playback_path(self, user)
        return self.video_url

    def get_duration_display(self):
        if self.video_duration:
            minutes, seconds = divmod(self.video_duration, 60)
            return f"{minutes}:{seconds:02d}"
        return f"{self.estimated_duration} min"


class Enrollment(models.Model):
    """Inscription d'un étudiant à un cours"""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Active')
        COMPLETED = 'COMPLETED', _('Terminée')
        CANCELLED = 'CANCELLED', _('Annulée')
        EXPIRED = 'EXPIRED', _('Expirée')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments', verbose_name=_('étudiant'))
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments', verbose_name=_('cours'))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name=_('statut'))

    progress = models.DecimalField(_('progression'), max_digits=5, decimal_places=2, default=0,
                                   validators=[MinValueValidator(0), MaxValueValidator(100)])
    completed_lessons = models.ManyToManyField(Lesson, related_name='completions', blank=True,
                                               verbose_name=_('leçons terminées'))
    current_lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='current_enrollments', verbose_name=_('leçon actuelle'))

    enrolled_at = models.DateTimeField(_("date d'inscription"), auto_now_add=True)
    completed_at = models.DateTimeField(_('date de fin'), null=True, blank=True)
    last_accessed = models.DateTimeField(_('dernier accès'), auto_now=True)

    certificate_issued = models.BooleanField(_('certificat délivré'), default=False)
    certificate_issued_at = models.DateTimeField(_('date de délivrance du certificat'), null=True, blank=True)

    class Meta:
        verbose_name = _('inscription')
        verbose_name_plural = _('inscriptions')
        unique_together = ['user', 'course']
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.course.title}"

    def is_accessible(self):
        return self.status in (self.Status.ACTIVE, self.Status.COMPLETED)

    def update_progress(self):
        lessons = Lesson.objects.filter(module__course=self.course, status=Lesson.Status.PUBLISHED)
        total = lessons.count()
        if total == 0:
            return
        done = self.completed_lessons.filter(id__in=lessons.values('id')).count()
        self.progress = round(done * 100 / total, 2)
        just_completed = self.progress >= 100 and self.status != self.Status.COMPLETED
        if just_completed:
            self.status = self.Status.COMPLETED
            self.completed_at = timezone.now()
        self.save(update_fields=['progress', 'status', 'completed_at'])

        if just_completed:
            self.course.update_enrollment_stats()
            if self.course.certificate_available:
                Certificate.issue_for(self)
            from users.models import UserProfile
            profile, _ = UserProfile.objects.get_or_create(user=self.user)
            profile.courses_completed = Enrollment.objects.filter(
                user=self.user, status=self.Status.COMPLETED).count()
            profile.save(update_fields=['courses_completed'])


class CourseReview(models.Model):
    """Avis sur un cours"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_reviews',
                             verbose_name=_('utilisateur'))
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='reviews', verbose_name=_('cours'))
    rating = models.PositiveIntegerField(_('note'), validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(_('titre'), max_length=200, blank=True)
    comment = models.TextField(_('commentaire'), blank=True)
    is_verified = models.BooleanField(_('achat vérifié'), default=True)
    is_hidden = models.BooleanField(_('masqué par la modération'), default=False)
    instructor_reply = models.TextField(_('réponse du formateur'), blank=True, max_length=2000)
    replied_at = models.DateTimeField(_('date de réponse'), null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('avis de cours')
        verbose_name_plural = _('avis de cours')
        unique_together = ['user', 'course']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.course.title} ({self.rating}/5)"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.course.update_rating()
        self.course.instructor.update_rating()

    def delete(self, *args, **kwargs):
        course = self.course
        result = super().delete(*args, **kwargs)
        course.update_rating()
        course.instructor.update_rating()
        return result


class CourseFavorite(models.Model):
    """Cours mis en favori par un utilisateur"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('favori')
        verbose_name_plural = _('favoris')
        unique_together = ['user', 'course']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} ♥ {self.course}"


class QuizAttempt(models.Model):
    """Tentative d'un étudiant sur une leçon de type quiz"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_attempts')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='quiz_attempts')
    answers = models.JSONField(default=list)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    passed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('tentative de quiz')
        verbose_name_plural = _('tentatives de quiz')
        ordering = ['-created_at']


class Certificate(models.Model):
    """Certificat de réussite, vérifiable publiquement par son code"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE, related_name='certificate')
    code = models.CharField(_('code de vérification'), max_length=20, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('certificat')
        verbose_name_plural = _('certificats')
        ordering = ['-issued_at']

    def __str__(self):
        return f"Certificat {self.code}"

    @classmethod
    def issue_for(cls, enrollment):
        cert, created = cls.objects.get_or_create(
            enrollment=enrollment, defaults={'code': secrets.token_hex(6).upper()})
        if created:
            enrollment.certificate_issued = True
            enrollment.certificate_issued_at = timezone.now()
            enrollment.save(update_fields=['certificate_issued', 'certificate_issued_at'])
            from notifications.services import notify
            notify(enrollment.user, 'CERTIFICATE', 'Certificat obtenu 🎉',
                   f'Vous avez terminé « {enrollment.course.title} »', f'/certificates/verify/{cert.code}')
        return cert
