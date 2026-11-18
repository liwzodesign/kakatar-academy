from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from users.permissions import IsAdminUser, IsFormateurUser
from notifications.services import notify

from .models import (
    Category, Certificate, Course, CourseFavorite, CourseReview, Enrollment, Lesson, Module, QuizAttempt,
)
from .serializers import (
    CategorySerializer, CertificateSerializer, CourseDetailSerializer, CourseListSerializer,
    CourseReviewCreateSerializer, CourseReviewSerializer, CourseWriteSerializer, EnrollmentSerializer,
    LessonSerializer, LessonWriteSerializer, ModuleSerializer, ModuleWriteSerializer, QuizAttemptSerializer,
    QuizSubmitSerializer,
)


def _published():
    return Course.objects.filter(status=Course.Status.PUBLISHED).select_related('instructor', 'category')


def _assert_owner(user, course):
    if not (user.role == 'ADMIN' or course.instructor_id == user.id):
        raise PermissionDenied("Vous n'êtes pas l'auteur de ce cours.")


def _owned_course(request, slug):
    course = get_object_or_404(Course, slug=slug)
    _assert_owner(request.user, course)
    return course


# ---------------------------------------------------------------------------
# Catalogue public
# ---------------------------------------------------------------------------
class CategoryListView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        return Category.objects.filter(is_active=True)


class CourseListView(generics.ListAPIView):
    """Catalogue des cours publiés, filtrable et paginé."""
    serializer_class = CourseListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['level', 'type', 'instructor', 'is_featured', 'is_premium', 'language']
    search_fields = ['title', 'subtitle', 'description', 'short_description',
                     'instructor__first_name', 'instructor__last_name', 'category__name']
    ordering_fields = ['price', 'rating_average', 'students_count', 'created_at', 'published_at']
    ordering = ['-published_at']

    def get_queryset(self):
        qs = _published()
        params = self.request.query_params
        category = params.get('category')
        if category:
            qs = qs.filter(Q(category__slug=category) | Q(category__parent__slug=category)) \
                if not category.isdigit() else qs.filter(category_id=category)
        for param, lookup in (('price_min', 'price__gte'), ('price_max', 'price__lte'),
                              ('duration_min', 'duration__gte'), ('duration_max', 'duration__lte')):
            value = params.get(param)
            if value:
                try:
                    qs = qs.filter(**{lookup: Decimal(value)})
                except Exception:
                    pass
        if params.get('free') == 'true':
            qs = qs.filter(price=0)
        return qs


CourseSearchView = CourseListView


class CourseDetailView(generics.RetrieveAPIView):
    """Détail d'un cours : public s'il est publié, sinon réservé à son auteur."""
    serializer_class = CourseDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Course.objects.select_related('instructor', 'category').prefetch_related('modules__lessons')
        user = self.request.user
        if user.is_authenticated:
            if user.role == 'ADMIN':
                return qs
            return qs.filter(Q(status=Course.Status.PUBLISHED) | Q(instructor=user))
        return qs.filter(status=Course.Status.PUBLISHED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def featured_courses(request):
    courses = _published().filter(is_featured=True)[:8]
    if not courses:
        courses = _published().order_by('-rating_average', '-students_count')[:8]
    return Response(CourseListSerializer(courses, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def trending_courses(request):
    since = timezone.now() - timedelta(days=30)
    courses = _published().annotate(
        recent=Count('enrollments', filter=Q(enrollments__enrolled_at__gte=since))
    ).order_by('-recent', '-rating_average')[:8]
    return Response(CourseListSerializer(courses, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def instructor_courses(request, instructor_id):
    courses = _published().filter(instructor_id=instructor_id).order_by('-published_at')
    return Response(CourseListSerializer(courses, many=True, context={'request': request}).data)


# ---------------------------------------------------------------------------
# Espace formateur : cours, modules, leçons
# ---------------------------------------------------------------------------
class InstructorCourseListView(generics.ListAPIView):
    """Tous les cours du formateur connecté (brouillons compris)."""
    serializer_class = CourseListSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_queryset(self):
        return Course.objects.filter(instructor=self.request.user).exclude(status=Course.Status.ARCHIVED) \
            .select_related('instructor', 'category').order_by('-updated_at')


class CourseCreateView(generics.CreateAPIView):
    serializer_class = CourseWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_create(self, serializer):
        course = serializer.save(instructor=self.request.user)
        self.request.user.refresh_instructor_stats()
        return course


class CourseUpdateView(generics.UpdateAPIView):
    serializer_class = CourseWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = 'slug'

    def get_object(self):
        return _owned_course(self.request, self.kwargs['slug'])


class CourseDeleteView(generics.DestroyAPIView):
    """Archive le cours (pas de suppression physique : les inscrits gardent l'historique)."""
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    lookup_field = 'slug'

    def get_object(self):
        return _owned_course(self.request, self.kwargs['slug'])

    def perform_destroy(self, instance):
        instance.status = Course.Status.ARCHIVED
        instance.save(update_fields=['status'])
        instance.instructor.refresh_instructor_stats()


class ModuleListView(generics.ListAPIView):
    serializer_class = ModuleSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Module.objects.filter(course__slug=self.kwargs['course_slug'],
                                     course__status=Course.Status.PUBLISHED).prefetch_related('lessons')


class ModuleCreateView(generics.CreateAPIView):
    serializer_class = ModuleWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]

    def perform_create(self, serializer):
        serializer.save(course=_owned_course(self.request, self.kwargs['course_slug']))


class ModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ModuleWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    queryset = Module.objects.select_related('course')

    def get_object(self):
        module = super().get_object()
        _assert_owner(self.request.user, module.course)
        return module

    def perform_destroy(self, instance):
        course = instance.course
        instance.delete()
        course.update_stats()


class LessonListView(generics.ListAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Lesson.objects.filter(module_id=self.kwargs['module_id'], status=Lesson.Status.PUBLISHED,
                                     module__course__status=Course.Status.PUBLISHED).select_related('module__course')


class LessonCreateView(generics.CreateAPIView):
    serializer_class = LessonWriteSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]

    def perform_create(self, serializer):
        module = get_object_or_404(Module.objects.select_related('course'), id=self.kwargs['module_id'])
        _assert_owner(self.request.user, module.course)
        serializer.save(module=module)
        module.course.update_stats()


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET : leçon (contenu verrouillé si non inscrit). PUT/PATCH/DELETE : formateur propriétaire."""
    queryset = Lesson.objects.select_related('module__course')

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsFormateurUser()]

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return LessonSerializer
        return LessonWriteSerializer

    def get_object(self):
        lesson = super().get_object()
        course = lesson.module.course
        if self.request.method in permissions.SAFE_METHODS:
            user = self.request.user
            is_owner = user.is_authenticated and (user.role == 'ADMIN' or course.instructor_id == user.id)
            if not is_owner and (course.status != Course.Status.PUBLISHED or lesson.status != Lesson.Status.PUBLISHED):
                from django.http import Http404
                raise Http404
        else:
            _assert_owner(self.request.user, course)
        return lesson

    def perform_update(self, serializer):
        lesson = serializer.save()
        lesson.module.course.update_stats()

    def perform_destroy(self, instance):
        course = instance.module.course
        instance.delete()
        course.update_stats()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
@parser_classes([MultiPartParser, FormParser])
def upload_lesson_video(request, pk):
    """Téléverse une vidéo pour une leçon puis lance le transcodage HLS (Celery)."""
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), pk=pk)
    _assert_owner(request.user, lesson.module.course)
    video = request.FILES.get('video')
    if not video:
        return Response({'error': 'Fichier « video » manquant'}, status=status.HTTP_400_BAD_REQUEST)
    if video.size > settings.MAX_VIDEO_UPLOAD_SIZE:
        return Response({'error': 'Vidéo trop volumineuse'}, status=status.HTTP_400_BAD_REQUEST)
    if not (video.content_type or '').startswith('video/'):
        return Response({'error': 'Le fichier doit être une vidéo'}, status=status.HTTP_400_BAD_REQUEST)
    lesson.video_file = video
    lesson.video_status = Lesson.VideoStatus.UPLOADED
    lesson.hls_playlist = ''
    lesson.type = Lesson.Type.VIDEO
    lesson.save()

    from .tasks import transcode_lesson_to_hls
    transaction.on_commit(lambda: transcode_lesson_to_hls.delay(str(lesson.id)))
    return Response(LessonWriteSerializer(lesson, context={'request': request}).data,
                    status=status.HTTP_202_ACCEPTED)


# ---------------------------------------------------------------------------
# Inscriptions & progression
# ---------------------------------------------------------------------------
class EnrollmentCreateView(generics.GenericAPIView):
    """
    Inscription directe pour les cours gratuits (ou inclus dans un abonnement actif).
    Les cours payants passent par /payments/checkout/.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EnrollmentSerializer

    def post(self, request, course_slug):
        course = get_object_or_404(Course, slug=course_slug, status=Course.Status.PUBLISHED)
        existing = Enrollment.objects.filter(user=request.user, course=course).first()
        if existing and existing.is_accessible():
            return Response(EnrollmentSerializer(existing, context={'request': request}).data)
        if course.instructor_id == request.user.id:
            return Response({'error': 'Vous êtes l\'auteur de ce cours.'}, status=status.HTTP_400_BAD_REQUEST)
        if not course.can_enroll():
            return Response({'error': 'Ce cours est complet.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = course.is_free()
        if not allowed and course.type == Course.Type.SUBSCRIPTION:
            from payments.models import Subscription
            allowed = Subscription.objects.active_for(request.user).exists()
        if not allowed:
            return Response({'error': 'Ce cours est payant : procédez au paiement.', 'requires_payment': True},
                            status=status.HTTP_402_PAYMENT_REQUIRED)

        enrollment = enroll_user(request.user, course)
        return Response(EnrollmentSerializer(enrollment, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


def enroll_user(user, course):
    """Crée (ou réactive) l'inscription et met à jour les compteurs. Utilisé aussi par les paiements."""
    enrollment, created = Enrollment.objects.get_or_create(user=user, course=course)
    if created:
        notify(user, 'ENROLLMENT', f'Bienvenue dans « {course.title} »', 'Bon apprentissage !',
               f'/learn/{course.slug}')
        notify(course.instructor, 'ENROLLMENT', 'Nouvel étudiant inscrit',
               f'{user.get_full_name()} a rejoint « {course.title} »', '/students')
    if not created and not enrollment.is_accessible():
        enrollment.status = Enrollment.Status.ACTIVE
        enrollment.save(update_fields=['status'])
    if enrollment.current_lesson_id is None:
        first = Lesson.objects.filter(module__course=course, status=Lesson.Status.PUBLISHED) \
            .order_by('module__order', 'order').first()
        if first:
            enrollment.current_lesson = first
            enrollment.save(update_fields=['current_lesson'])
    course.update_enrollment_stats()
    course.instructor.refresh_instructor_stats()
    return enrollment


class EnrollmentListView(generics.ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user).exclude(status=Enrollment.Status.CANCELLED) \
            .select_related('course__instructor', 'course__category', 'certificate').order_by('-last_accessed')


class EnrollmentDetailView(generics.RetrieveAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user)


def _update_streak(user):
    from users.models import UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=user)
    today = timezone.localdate()
    last = user.last_activity and timezone.localdate(user.last_activity)
    if last == today and profile.current_streak:
        return profile
    if last == today - timedelta(days=1):
        profile.current_streak += 1
    else:
        profile.current_streak = 1
    profile.longest_streak = max(profile.longest_streak, profile.current_streak)
    profile.save(update_fields=['current_streak', 'longest_streak'])
    return profile


GRADED_TYPES = (Lesson.Type.ASSIGNMENT, Lesson.Type.PROJECT)


def lesson_submission_approved(user, lesson):
    from assignments.models import Submission
    return Submission.objects.filter(user=user, lesson=lesson, status=Submission.Status.APPROVED).exists()


def complete_lesson_for(enrollment, lesson):
    """
    Valide une leçon pour une inscription : progression, leçon suivante, série et temps d'étude.
    Utilisé par l'étudiant (bouton « Terminer ») et par le formateur (devoir approuvé).
    Renvoie l'identifiant de la prochaine leçon non terminée.
    """
    user = enrollment.user
    course = enrollment.course
    newly_completed = not enrollment.completed_lessons.filter(id=lesson.id).exists()
    enrollment.completed_lessons.add(lesson)
    ordered = list(Lesson.objects.filter(module__course=course, status=Lesson.Status.PUBLISHED)
                   .order_by('module__order', 'order').values_list('id', flat=True))
    done = set(enrollment.completed_lessons.values_list('id', flat=True))
    next_id = next((lid for lid in ordered if lid not in done), None)
    enrollment.current_lesson_id = next_id or lesson.id
    enrollment.save(update_fields=['current_lesson', 'last_accessed'])
    enrollment.update_progress()

    if newly_completed:
        profile = _update_streak(user)
        profile.total_study_time += lesson.get_minutes()
        profile.save(update_fields=['total_study_time'])
        from analytics.models import DailyActivity
        DailyActivity.record_lesson(user, lesson.get_minutes())
        user.last_activity = timezone.now()
        user.save(update_fields=['last_activity'])
    return next_id


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_lesson_completed(request, lesson_id):
    """Marque la leçon comme terminée, avance la leçon courante, met à jour la progression."""
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=lesson_id)
    course = lesson.module.course
    enrollment = request.user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).first()
    if not enrollment:
        return Response({'error': 'Vous devez être inscrit au cours.'}, status=status.HTTP_403_FORBIDDEN)
    if lesson.type == Lesson.Type.QUIZ and lesson.quiz and not QuizAttempt.objects.filter(
            user=request.user, lesson=lesson, passed=True).exists():
        return Response({'error': 'Réussissez le quiz pour valider cette leçon.'}, status=status.HTTP_400_BAD_REQUEST)

    if lesson.type in GRADED_TYPES and not lesson_submission_approved(request.user, lesson):
        return Response({'error': 'Ce travail doit être rendu puis validé par le formateur.'},
                        status=status.HTTP_400_BAD_REQUEST)

    next_id = complete_lesson_for(enrollment, lesson)
    enrollment.refresh_from_db()
    return Response({
        'message': 'Leçon terminée',
        'progress': float(enrollment.progress),
        'status': enrollment.status,
        'next_lesson': str(next_id) if next_id else None,
        'certificate_code': getattr(getattr(enrollment, 'certificate', None), 'code', None),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_quiz(request, lesson_id):
    """Corrige un quiz. Corps : {"answers": [index_option_q1, index_option_q2, ...]}"""
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=lesson_id)
    if not request.user.enrollments.filter(course=lesson.module.course, status__in=['ACTIVE', 'COMPLETED']).exists() \
            and not lesson.is_free:
        return Response({'error': 'Vous devez être inscrit au cours.'}, status=status.HTTP_403_FORBIDDEN)
    if not lesson.quiz:
        return Response({'error': "Cette leçon n'a pas de quiz."}, status=status.HTTP_400_BAD_REQUEST)
    serializer = QuizSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    answers = serializer.validated_data['answers']
    questions = lesson.quiz
    correct = sum(1 for i, q in enumerate(questions) if i < len(answers) and answers[i] == q.get('answer'))
    score = round(Decimal(correct * 100) / len(questions), 2)
    attempt = QuizAttempt.objects.create(user=request.user, lesson=lesson, answers=answers, score=score,
                                         passed=score >= lesson.passing_score)
    from analytics.learning import schedule_from_quiz
    schedule_from_quiz(request.user, lesson, answers)
    corrections = [{'correct': i < len(answers) and answers[i] == q.get('answer'), 'answer': q.get('answer'),
                    'explanation': q.get('explanation', '')} for i, q in enumerate(questions)]
    return Response({**QuizAttemptSerializer(attempt).data, 'corrections': corrections})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_progress(request, course_slug):
    enrollment = request.user.enrollments.filter(course__slug=course_slug).select_related('course').first()
    if not enrollment:
        return Response({'error': 'Inscription non trouvée'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'progress': float(enrollment.progress),
        'status': enrollment.status,
        'completed_lessons': [str(i) for i in enrollment.completed_lessons.values_list('id', flat=True)],
        'total_lessons': enrollment.course.lessons_count,
        'current_lesson': str(enrollment.current_lesson_id) if enrollment.current_lesson_id else None,
    })


# ---------------------------------------------------------------------------
# Avis
# ---------------------------------------------------------------------------
class CourseReviewListView(generics.ListAPIView):
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return CourseReview.objects.filter(course__slug=self.kwargs['course_slug'], is_hidden=False) \
            .select_related('user')


class CourseReviewCreateView(generics.CreateAPIView):
    serializer_class = CourseReviewCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['course'] = get_object_or_404(Course, slug=self.kwargs['course_slug'])
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from ai_services.services import moderate_text
        text = f"{serializer.validated_data.get('title', '')} {serializer.validated_data.get('comment', '')}"
        hidden = moderate_text(text)['flagged']
        review = serializer.save(user=request.user, course=self.get_serializer_context()['course'], is_hidden=hidden)
        data = CourseReviewSerializer(review).data
        data['pending_moderation'] = hidden
        if not hidden:
            course = review.course
            notify(course.instructor, 'REVIEW', f'Nouvel avis ({review.rating}/5) sur « {course.title} »',
                   review.comment[:200], f'/courses/{course.slug}')
        return Response(data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Favoris
# ---------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_course_favorite(request, course_slug):
    course = get_object_or_404(Course, slug=course_slug, status=Course.Status.PUBLISHED)
    favorite, created = CourseFavorite.objects.get_or_create(user=request.user, course=course)
    if not created:
        favorite.delete()
    return Response({'is_favorite': created})


class FavoriteListView(generics.ListAPIView):
    serializer_class = CourseListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return _published().filter(favorited_by__user=self.request.user)


# ---------------------------------------------------------------------------
# Certificats
# ---------------------------------------------------------------------------
class MyCertificatesView(generics.ListAPIView):
    serializer_class = CertificateSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Certificate.objects.filter(enrollment__user=self.request.user) \
            .select_related('enrollment__course__instructor', 'enrollment__user')


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_certificate(request, code):
    """Vérification publique d'un certificat (ex. par un recruteur)."""
    cert = get_object_or_404(Certificate.objects.select_related('enrollment__course__instructor', 'enrollment__user'),
                             code=code.upper())
    return Response(CertificateSerializer(cert).data)


# ---------------------------------------------------------------------------
# Analytics d'un cours (formateur)
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_analytics(request, course_slug):
    course = _owned_course(request, course_slug)
    enrollments = course.enrollments.all()
    total = enrollments.count()
    completed = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
    from payments.models import Commission
    revenue = Commission.objects.filter(payment__course_purchase__course=course).aggregate(
        gross=Sum('total_amount'), net=Sum('instructor_amount'))
    since = timezone.now() - timedelta(days=30)
    daily = (enrollments.filter(enrolled_at__gte=since)
             .annotate(day=TruncDate('enrolled_at')).values('day').annotate(count=Count('id')).order_by('day'))
    lessons = (Lesson.objects.filter(module__course=course, status=Lesson.Status.PUBLISHED)
               .annotate(completions_count=Count('completions')).order_by('module__order', 'order'))
    return Response({
        'total_enrollments': total,
        'active_enrollments': enrollments.filter(status=Enrollment.Status.ACTIVE).count(),
        'completed_enrollments': completed,
        'avg_progress': float(enrollments.aggregate(a=Avg('progress'))['a'] or 0),
        'completion_rate': round(completed * 100 / total, 2) if total else 0,
        'gross_revenue': float(revenue['gross'] or 0),
        'net_revenue': float(revenue['net'] or 0),
        'rating_average': float(course.rating_average),
        'rating_count': course.rating_count,
        'enrollments_last_30_days': [{'day': str(d['day']), 'count': d['count']} for d in daily],
        'lesson_funnel': [{'id': str(lesson.id), 'title': lesson.title, 'completions': lesson.completions_count}
                          for lesson in lessons],
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reply_to_review(request, pk):
    """Le formateur du cours répond publiquement à un avis (corps : {"reply": "..."} ; vide = supprimer)."""
    review = get_object_or_404(CourseReview.objects.select_related('course', 'user'), pk=pk)
    _assert_owner(request.user, review.course)
    reply = (request.data.get('reply') or '').strip()[:2000]
    review.instructor_reply = reply
    review.replied_at = timezone.now() if reply else None
    # update() : ne pas recalculer les notes (save() de CourseReview le ferait)
    CourseReview.objects.filter(pk=review.pk).update(instructor_reply=reply, replied_at=review.replied_at)
    if reply:
        from notifications.services import notify
        notify(review.user, 'REVIEW', f'Le formateur a répondu à votre avis sur « {review.course.title} »', reply[:200],
               f'/courses/{review.course.slug}')
    return Response(CourseReviewSerializer(review).data)


def lesson_media(request, token, subpath):
    """Vidéo protégée d'une leçon (voir courses/media.py). Pas d'authentification JWT : le jeton signé suffit."""
    from .media import serve_lesson_media
    return serve_lesson_media(request, token, subpath)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lesson_offline_package(request, pk):
    """
    Données pour enregistrer une leçon hors connexion : contenu + URL de la vidéo à télécharger.
    Seules les vidéos MP4 (hébergées ou liens directs .mp4) sont téléchargeables ; YouTube/Vimeo ne le sont pas.
    """
    from .media import make_token, user_can_watch
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), pk=pk)
    if not user_can_watch(request.user, lesson):
        return Response({'error': 'Inscription requise.'}, status=status.HTTP_403_FORBIDDEN)
    course = lesson.module.course
    if lesson.video_file:
        video, size = f"/api/v1/courses/media/{make_token(lesson, request.user)}/video", lesson.video_file.size
    elif lesson.video_url and lesson.video_url.split('?')[0].lower().endswith('.mp4'):
        video, size = lesson.video_url, None
    else:
        video, size = '', None
    return Response({
        'lesson': LessonSerializer(lesson, context={'request': request}).data,
        'course': {'slug': course.slug, 'title': course.title, 'thumbnail': course.get_thumbnail_url()},
        'video_download_url': video,
        'video_size': size,
        'video_downloadable': bool(video) or lesson.type != Lesson.Type.VIDEO,
        'reason': '' if video or lesson.type != Lesson.Type.VIDEO else 'Les vidéos YouTube ou Vimeo ne peuvent pas être enregistrées hors connexion.',
    })
