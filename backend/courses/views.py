from rest_framework import status, generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count, Avg, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend

from .models import Course, Module, Lesson, Enrollment, CourseReview, Category
from .serializers import (
    CourseListSerializer, CourseDetailSerializer, CourseCreateSerializer,
    CourseUpdateSerializer, ModuleSerializer, ModuleCreateSerializer,
    LessonSerializer, LessonCreateSerializer, EnrollmentSerializer,
    CourseReviewSerializer, CourseReviewCreateSerializer, CategorySerializer,
    CourseSearchSerializer
)
from users.permissions import IsVerifiedFormateur, IsCourseInstructor, IsEnrolledStudent

class CategoryListView(generics.ListAPIView):
    """Vue pour lister les catégories"""
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class CourseListView(generics.ListAPIView):
    """Vue pour lister les cours"""
    serializer_class = CourseListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'level', 'type', 'instructor', 'is_featured', 'is_premium']
    search_fields = ['title', 'subtitle', 'description', 'tags']
    ordering_fields = ['price', 'rating_average', 'students_count', 'created_at', 'published_at']
    ordering = ['-published_at']
    
    def get_queryset(self):
        queryset = Course.objects.filter(status='PUBLISHED')
        
        # Filtres personnalisés
        price_min = self.request.query_params.get('price_min')
        price_max = self.request.query_params.get('price_max')
        duration_min = self.request.query_params.get('duration_min')
        duration_max = self.request.query_params.get('duration_max')
        
        if price_min:
            queryset = queryset.filter(price__gte=price_min)
        if price_max:
            queryset = queryset.filter(price__lte=price_max)
        if duration_min:
            queryset = queryset.filter(duration__gte=duration_min)
        if duration_max:
            queryset = queryset.filter(duration__lte=duration_max)
        
        # Filtre par langue
        language = self.request.query_params.get('language')
        if language:
            queryset = queryset.filter(language=language)
        
        return queryset.select_related('instructor', 'category').prefetch_related('tags')

class CourseDetailView(generics.RetrieveAPIView):
    """Vue pour afficher les détails d'un cours"""
    queryset = Course.objects.filter(status='PUBLISHED')
    serializer_class = CourseDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    
    def get_queryset(self):
        return Course.objects.filter(status='PUBLISHED').select_related(
            'instructor', 'category'
        ).prefetch_related(
            'modules__lessons', 'reviews__user', 'co_instructors'
        )

class CourseCreateView(generics.CreateAPIView):
    """Vue pour créer un cours"""
    serializer_class = CourseCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerifiedFormateur]
    
    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)

class CourseUpdateView(generics.UpdateAPIView):
    """Vue pour mettre à jour un cours"""
    queryset = Course.objects.all()
    serializer_class = CourseUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseInstructor]
    lookup_field = 'slug'

class CourseDeleteView(generics.DestroyAPIView):
    """Vue pour supprimer un cours"""
    queryset = Course.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsCourseInstructor]
    lookup_field = 'slug'
    
    def perform_destroy(self, instance):
        # Marquer comme archivé au lieu de supprimer
        instance.status = 'ARCHIVED'
        instance.save()

class ModuleListView(generics.ListAPIView):
    """Vue pour lister les modules d'un cours"""
    serializer_class = ModuleSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        course_slug = self.kwargs.get('course_slug')
        return Module.objects.filter(
            course__slug=course_slug,
            course__status='PUBLISHED'
        ).prefetch_related('lessons')

class ModuleCreateView(generics.CreateAPIView):
    """Vue pour créer un module"""
    serializer_class = ModuleCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseInstructor]
    
    def perform_create(self, serializer):
        course_slug = self.kwargs.get('course_slug')
        course = Course.objects.get(slug=course_slug)
        serializer.save(course=course)

class LessonListView(generics.ListAPIView):
    """Vue pour lister les leçons d'un module"""
    serializer_class = LessonSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        module_id = self.kwargs.get('module_id')
        return Lesson.objects.filter(
            module_id=module_id,
            status='PUBLISHED'
        ).order_by('order')

class LessonCreateView(generics.CreateAPIView):
    """Vue pour créer une leçon"""
    serializer_class = LessonCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseInstructor]
    
    def perform_create(self, serializer):
        module_id = self.kwargs.get('module_id')
        module = Module.objects.get(id=module_id)
        serializer.save(module=module)

class LessonDetailView(generics.RetrieveAPIView):
    """Vue pour afficher les détails d'une leçon"""
    queryset = Lesson.objects.filter(status='PUBLISHED')
    serializer_class = LessonSerializer
    permission_classes = [permissions.AllowAny]

class EnrollmentCreateView(generics.CreateAPIView):
    """Vue pour s'inscrire à un cours"""
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        course_slug = self.kwargs.get('course_slug')
        course = Course.objects.get(slug=course_slug)
        
        # Vérifier si l'utilisateur est déjà inscrit
        if Enrollment.objects.filter(user=self.request.user, course=course).exists():
            raise serializers.ValidationError("Vous êtes déjà inscrit à ce cours.")
        
        # Créer l'inscription
        enrollment = serializer.save(user=self.request.user, course=course)
        
        # Mettre à jour le nombre d'étudiants du cours
        course.students_count = course.enrollments.filter(status='ACTIVE').count()
        course.save(update_fields=['students_count'])

class EnrollmentListView(generics.ListAPIView):
    """Vue pour lister les inscriptions de l'utilisateur"""
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Enrollment.objects.filter(
            user=self.request.user
        ).select_related('course', 'current_lesson').order_by('-enrolled_at')

class EnrollmentDetailView(generics.RetrieveAPIView):
    """Vue pour afficher les détails d'une inscription"""
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user)

class CourseReviewListView(generics.ListAPIView):
    """Vue pour lister les avis d'un cours"""
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        course_slug = self.kwargs.get('course_slug')
        return CourseReview.objects.filter(
            course__slug=course_slug,
            is_verified=True
        ).select_related('user').order_by('-created_at')

class CourseReviewCreateView(generics.CreateAPIView):
    """Vue pour créer un avis sur un cours"""
    serializer_class = CourseReviewCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        course_slug = self.kwargs.get('course_slug')
        course = Course.objects.get(slug=course_slug)
        
        # Créer l'avis
        review = serializer.save(user=self.request.user, course=course)
        
        # Mettre à jour les statistiques du cours
        course.update_rating()

class CourseSearchView(generics.ListAPIView):
    """Vue pour rechercher des cours"""
    serializer_class = CourseSearchSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'subtitle', 'description', 'tags', 'instructor__first_name', 'instructor__last_name']
    ordering_fields = ['price', 'rating_average', 'students_count', 'created_at']
    ordering = ['-rating_average']
    
    def get_queryset(self):
        queryset = Course.objects.filter(status='PUBLISHED')
        
        # Filtres avancés
        category = self.request.query_params.get('category')
        level = self.request.query_params.get('level')
        price_range = self.request.query_params.get('price_range')
        duration_range = self.request.query_params.get('duration_range')
        
        if category:
            queryset = queryset.filter(category__slug=category)
        if level:
            queryset = queryset.filter(level=level)
        if price_range:
            min_price, max_price = map(float, price_range.split(','))
            queryset = queryset.filter(price__range=(min_price, max_price))
        if duration_range:
            min_duration, max_duration = map(int, duration_range.split(','))
            queryset = queryset.filter(duration__range=(min_duration, max_duration))
        
        return queryset.select_related('instructor', 'category')

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_lesson_completed(request, lesson_id):
    """Marquer une leçon comme terminée"""
    try:
        lesson = Lesson.objects.get(id=lesson_id)
        enrollment = request.user.enrollments.filter(
            course=lesson.module.course,
            status='ACTIVE'
        ).first()
        
        if not enrollment:
            return Response(
                {'error': 'Vous devez être inscrit au cours pour marquer une leçon comme terminée.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Ajouter la leçon aux leçons terminées
        enrollment.completed_lessons.add(lesson)
        
        # Mettre à jour la progression
        enrollment.update_progress()
        
        return Response({'message': 'Leçon marquée comme terminée'})
        
    except Lesson.DoesNotExist:
        return Response({'error': 'Leçon non trouvée'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_progress(request, course_slug):
    """Obtenir la progression dans un cours"""
    try:
        enrollment = request.user.enrollments.get(
            course__slug=course_slug,
            status='ACTIVE'
        )
        
        return Response({
            'progress': enrollment.progress,
            'completed_lessons_count': enrollment.completed_lessons.count(),
            'total_lessons': enrollment.course.lessons_count,
            'current_lesson': enrollment.current_lesson.id if enrollment.current_lesson else None
        })
        
    except Enrollment.DoesNotExist:
        return Response({'error': 'Inscription non trouvée'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def featured_courses(request):
    """Obtenir les cours mis en avant"""
    featured = Course.objects.filter(
        status='PUBLISHED',
        is_featured=True
    ).select_related('instructor', 'category')[:8]
    
    serializer = CourseListSerializer(featured, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def trending_courses(request):
    """Obtenir les cours tendance"""
    trending = Course.objects.filter(
        status='PUBLISHED'
    ).annotate(
        recent_enrollments=Count(
            'enrollments',
            filter=Q(enrollments__enrolled_at__gte=timezone.now() - timezone.timedelta(days=30))
        )
    ).order_by('-recent_enrollments', '-rating_average')[:8]
    
    serializer = CourseListSerializer(trending, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def instructor_courses(request, instructor_id):
    """Obtenir les cours d'un instructeur"""
    courses = Course.objects.filter(
        instructor_id=instructor_id,
        status='PUBLISHED'
    ).select_related('category').order_by('-published_at')
    
    serializer = CourseListSerializer(courses, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_course_favorite(request, course_slug):
    """Ajouter/retirer un cours des favoris"""
    # À implémenter selon vos besoins (modèle UserFavorites)
    return Response({'message': 'Fonctionnalité à implémenter'})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_analytics(request, course_slug):
    """Obtenir les analytics d'un cours (pour l'instructeur)"""
    try:
        course = Course.objects.get(slug=course_slug)
        
        # Vérifier que l'utilisateur est l'instructeur
        if course.instructor != request.user and request.user.role != 'ADMIN':
            return Response(
                {'error': 'Accès non autorisé'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Statistiques du cours
        total_enrollments = course.enrollments.count()
        active_enrollments = course.enrollments.filter(status='ACTIVE').count()
        completed_enrollments = course.enrollments.filter(status='COMPLETED').count()
        
        # Progression moyenne
        avg_progress = course.enrollments.filter(status='ACTIVE').aggregate(
            avg_progress=Avg('progress')
        )['avg_progress'] or 0
        
        # Revenus (si applicable)
        total_revenue = course.enrollments.filter(
            status='ACTIVE'
        ).aggregate(
            total_revenue=Sum('course__price')
        )['total_revenue'] or 0
        
        return Response({
            'total_enrollments': total_enrollments,
            'active_enrollments': active_enrollments,
            'completed_enrollments': completed_enrollments,
            'avg_progress': avg_progress,
            'total_revenue': total_revenue,
            'completion_rate': (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0
        })
        
    except Course.DoesNotExist:
        return Response({'error': 'Cours non trouvé'}, status=status.HTTP_404_NOT_FOUND) 