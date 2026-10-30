from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from users.permissions import IsVerifiedFormateur

from .access import ACCESS_STATUSES, can_view_lesson, get_enrollment, is_course_staff
from .certificates import render_certificate_pdf
from .models import Category, Course, CourseReview, Enrollment, Lesson, Module
from .serializers import (
    CategorySerializer, CourseCreateSerializer, CourseDetailSerializer,
    CourseListSerializer, CourseReviewCreateSerializer, CourseReviewSerializer,
    CourseUpdateSerializer, EnrollmentSerializer, LessonCreateSerializer,
    LessonSerializer, ModuleCreateSerializer, ModuleSerializer,
)


def _published_course(slug):
    return get_object_or_404(Course, slug=slug, status=Course.Status.PUBLISHED)


def _course_for_staff(user, slug):
    course = get_object_or_404(Course, slug=slug)
    if not is_course_staff(user, course):
        raise PermissionDenied("Vous n'êtes pas formateur de ce cours.")
    return course


# --- Catalogue ---------------------------------------------------------------

class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.filter(is_active=True, parent__isnull=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class CourseListView(generics.ListAPIView):
    """Catalogue public : ?search=, ?category=<slug>, ?level=, ?type=FREE|PAID, ?ordering="""
    serializer_class = CourseListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['level', 'type', 'is_featured']
    search_fields = ['title', 'subtitle', 'description', 'instructor__first_name', 'instructor__last_name']
    ordering_fields = ['price', 'rating_average', 'students_count', 'published_at']
    ordering = ['-is_featured', '-published_at']

    def get_queryset(self):
        qs = Course.objects.filter(status=Course.Status.PUBLISHED).select_related('instructor', 'category')
        params = self.request.query_params
        if params.get('category'):
            qs = qs.filter(Q(category__slug=params['category']) | Q(category__parent__slug=params['category']))
        if params.get('price_max'):
            qs = qs.filter(price__lte=params['price_max'])
        return qs


class CourseDetailView(generics.RetrieveAPIView):
    serializer_class = CourseDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Course.objects.select_related('instructor', 'category')
        user = self.request.user
        if user.is_authenticated:
            # Le formateur voit aussi ses brouillons
            return qs.filter(Q(status=Course.Status.PUBLISHED) | Q(instructor=user))
        return qs.filter(status=Course.Status.PUBLISHED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def featured_courses(request):
    featured = Course.objects.filter(status=Course.Status.PUBLISHED, is_featured=True) \
        .select_related('instructor', 'category')[:8]
    return Response(CourseListSerializer(featured, many=True, context={'request': request}).data)


# --- Gestion par le formateur ------------------------------------------------

class CourseCreateView(generics.CreateAPIView):
    serializer_class = CourseCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerifiedFormateur]

    def perform_create(self, serializer):
        course = serializer.save(instructor=self.request.user)
        if course.status == Course.Status.PUBLISHED and not course.published_at:
            course.published_at = timezone.now()
            course.save(update_fields=['published_at'])


class InstructorCourseListView(generics.ListAPIView):
    """Cours dont je suis formateur (brouillons compris)"""
    serializer_class = CourseListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Course.objects.filter(instructor=self.request.user).exclude(status=Course.Status.ARCHIVED)


class CourseUpdateView(generics.UpdateAPIView):
    serializer_class = CourseUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'slug'

    def get_object(self):
        return _course_for_staff(self.request.user, self.kwargs['slug'])

    def perform_update(self, serializer):
        course = serializer.save()
        if course.status == Course.Status.PUBLISHED and not course.published_at:
            course.published_at = timezone.now()
            course.save(update_fields=['published_at'])


class CourseDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return _course_for_staff(self.request.user, self.kwargs['slug'])

    def perform_destroy(self, instance):
        instance.status = Course.Status.ARCHIVED  # archivage plutôt que suppression
        instance.save(update_fields=['status'])


class ModuleCreateView(generics.CreateAPIView):
    serializer_class = ModuleCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        course = _course_for_staff(self.request.user, self.kwargs['course_slug'])
        if 'order' not in serializer.validated_data:
            serializer.validated_data['order'] = course.modules.count() + 1
        serializer.save(course=course)


class LessonCreateView(generics.CreateAPIView):
    serializer_class = LessonCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        module = get_object_or_404(Module, id=self.kwargs['module_id'])
        if not is_course_staff(self.request.user, module.course):
            raise PermissionDenied("Vous n'êtes pas formateur de ce cours.")
        if 'order' not in serializer.validated_data:
            serializer.validated_data['order'] = module.lessons.count() + 1
        serializer.save(module=module)


# --- Apprentissage -----------------------------------------------------------

class LessonDetailView(generics.RetrieveAPIView):
    """Contenu d'une leçon : aperçu gratuit, inscrit, ou formateur"""
    serializer_class = LessonSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        lesson = get_object_or_404(
            Lesson.objects.select_related('module__course'),
            id=self.kwargs['pk'], status=Lesson.Status.PUBLISHED,
        )
        if not can_view_lesson(self.request.user, lesson):
            raise PermissionDenied("Inscrivez-vous au cours pour accéder à cette leçon.")
        enrollment = get_enrollment(self.request.user, lesson.module.course)
        if enrollment and enrollment.current_lesson_id != lesson.id:
            enrollment.current_lesson = lesson
            enrollment.save(update_fields=['current_lesson', 'last_accessed'])
        return lesson


class EnrollmentCreateView(generics.CreateAPIView):
    """Inscription directe : uniquement pour les cours gratuits.
    Les cours payants passent par /api/v1/payments/checkout/."""
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        course = _published_course(self.kwargs['course_slug'])
        if not course.is_free():
            raise serializers.ValidationError(
                {'detail': 'Ce cours est payant : passez par le paiement.', 'requires_payment': True})
        if not course.can_enroll():
            raise serializers.ValidationError({'detail': 'Ce cours est complet.'})
        if Enrollment.objects.filter(user=self.request.user, course=course).exists():
            raise serializers.ValidationError({'detail': 'Vous êtes déjà inscrit à ce cours.'})
        serializer.save(user=self.request.user, course=course)
        course.update_students_count()


class EnrollmentListView(generics.ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user, status__in=ACCESS_STATUSES) \
            .select_related('course__instructor').order_by('-last_accessed')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_lesson_completed(request, lesson_id):
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'),
                               id=lesson_id, status=Lesson.Status.PUBLISHED)
    enrollment = get_enrollment(request.user, lesson.module.course)
    if not enrollment:
        return Response({'error': 'Vous devez être inscrit au cours.'}, status=status.HTTP_403_FORBIDDEN)
    enrollment.completed_lessons.add(lesson)
    enrollment.update_progress()
    enrollment.refresh_from_db()
    return Response({
        'progress': enrollment.progress,
        'status': enrollment.status,
        'certificate_issued': enrollment.certificate_issued,
        'certificate_code': enrollment.certificate_code or None,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_progress(request, course_slug):
    course = get_object_or_404(Course, slug=course_slug)
    enrollment = get_enrollment(request.user, course)
    if not enrollment:
        return Response({'error': 'Inscription non trouvée'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'progress': enrollment.progress,
        'status': enrollment.status,
        'completed_lessons': [str(i) for i in enrollment.completed_lessons.values_list('id', flat=True)],
        'total_lessons': course.lessons_count,
        'current_lesson': enrollment.current_lesson_id,
        'certificate_issued': enrollment.certificate_issued,
    })


# --- Certificats -------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_certificate(request, course_slug):
    course = get_object_or_404(Course, slug=course_slug)
    enrollment = get_object_or_404(Enrollment, user=request.user, course=course)
    if not enrollment.certificate_issued:
        return Response({'error': "Terminez toutes les leçons pour obtenir le certificat."},
                        status=status.HTTP_403_FORBIDDEN)
    pdf = render_certificate_pdf(enrollment)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="certificat-{course.slug}.pdf"'
    return response


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_certificate(request, code):
    """Vérification publique d'un certificat (lien imprimé sur le PDF)"""
    enrollment = Enrollment.objects.select_related('user', 'course') \
        .filter(certificate_code__iexact=code, certificate_issued=True).first()
    if not enrollment:
        return Response({'valid': False}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'valid': True,
        'code': enrollment.certificate_code,
        'student': enrollment.user.get_full_name(),
        'course': enrollment.course.title,
        'issued_at': enrollment.certificate_issued_at,
    })


# --- Avis --------------------------------------------------------------------

class CourseReviewListView(generics.ListAPIView):
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return CourseReview.objects.filter(course__slug=self.kwargs['course_slug']) \
            .select_related('user').order_by('-created_at')


class CourseReviewCreateView(generics.CreateAPIView):
    serializer_class = CourseReviewCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['course'] = _published_course(self.kwargs['course_slug'])
        return ctx

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, course=serializer.context['course'])


# --- Statistiques formateur --------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_analytics(request, course_slug):
    course = _course_for_staff(request.user, course_slug)
    enrollments = course.enrollments.exclude(status=Enrollment.Status.CANCELLED)
    total = enrollments.count()
    completed = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
    from payments.models import Payment
    revenue = sum(
        p.amount for p in Payment.objects.filter(
            status=Payment.Status.COMPLETED, course_purchase__course=course)
    )
    return Response({
        'total_enrollments': total,
        'completed_enrollments': completed,
        'avg_progress': enrollments.aggregate(v=Avg('progress'))['v'] or 0,
        'completion_rate': round(completed * 100 / total, 1) if total else 0,
        'total_revenue': revenue,
        'currency': course.currency,
    })
