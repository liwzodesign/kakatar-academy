from rest_framework import serializers
from django.db.models import Avg, Count
from .models import Course, Module, Lesson, Enrollment, CourseReview, Category

class CategorySerializer(serializers.ModelSerializer):
    """Sérialiseur pour les catégories"""
    
    children = serializers.SerializerMethodField()
    courses_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'icon', 'color',
            'parent', 'is_active', 'order', 'children', 'courses_count'
        ]
    
    def get_children(self, obj):
        """Retourne les sous-catégories"""
        children = Category.objects.filter(parent=obj, is_active=True)
        return CategorySerializer(children, many=True).data
    
    def get_courses_count(self, obj):
        """Retourne le nombre de cours dans cette catégorie"""
        return obj.courses.filter(status='PUBLISHED').count()

class LessonSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les leçons"""
    
    duration_display = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    
    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'description', 'type', 'order', 'content',
            'video_url', 'video_duration', 'video_thumbnail', 'resources',
            'attachments', 'is_free', 'is_required', 'estimated_duration',
            'status', 'duration_display', 'is_completed'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_duration_display(self, obj):
        return obj.get_duration_display()
    
    def get_is_completed(self, obj):
        """Vérifie si la leçon est terminée par l'utilisateur actuel"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = request.user.enrollments.filter(
                course=obj.module.course,
                status='ACTIVE'
            ).first()
            if enrollment:
                return enrollment.completed_lessons.filter(id=obj.id).exists()
        return False

class ModuleSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les modules"""
    
    lessons = LessonSerializer(many=True, read_only=True)
    lessons_count = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = Module
        fields = [
            'id', 'title', 'description', 'order', 'is_free',
            'lessons', 'lessons_count', 'duration', 'progress'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_lessons_count(self, obj):
        return obj.get_lessons_count()
    
    def get_duration(self):
        return obj.get_duration()
    
    def get_progress(self, obj):
        """Calcule la progression dans le module"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = request.user.enrollments.filter(
                course=obj.course,
                status='ACTIVE'
            ).first()
            if enrollment:
                completed_lessons = enrollment.completed_lessons.filter(module=obj).count()
                total_lessons = obj.lessons.count()
                if total_lessons > 0:
                    return (completed_lessons / total_lessons) * 100
        return 0

class CourseReviewSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les avis de cours"""
    
    user = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    
    class Meta:
        model = CourseReview
        fields = [
            'id', 'user', 'user_avatar', 'rating', 'title', 'comment',
            'created_at', 'updated_at', 'is_verified'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_verified']
    
    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'name': obj.user.get_full_name(),
            'role': obj.user.role
        }
    
    def get_user_avatar(self, obj):
        return obj.user.get_avatar_url()

class CourseReviewCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un avis de cours"""
    
    class Meta:
        model = CourseReview
        fields = ['rating', 'title', 'comment']
    
    def validate(self, attrs):
        """Vérifie que l'utilisateur est inscrit au cours"""
        request = self.context.get('request')
        course = self.context.get('course')
        
        if request and course:
            # Vérifier si l'utilisateur est inscrit au cours
            if not request.user.enrollments.filter(course=course, status='ACTIVE').exists():
                raise serializers.ValidationError(
                    "Vous devez être inscrit au cours pour laisser un avis."
                )
            
            # Vérifier si l'utilisateur a déjà laissé un avis
            if CourseReview.objects.filter(user=request.user, course=course).exists():
                raise serializers.ValidationError(
                    "Vous avez déjà laissé un avis pour ce cours."
                )
        
        return attrs

class EnrollmentSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les inscriptions"""
    
    course = serializers.SerializerMethodField()
    current_lesson = LessonSerializer(read_only=True)
    
    class Meta:
        model = Enrollment
        fields = [
            'id', 'course', 'status', 'progress', 'completed_lessons',
            'current_lesson', 'enrolled_at', 'completed_at', 'last_accessed',
            'certificate_issued', 'certificate_issued_at'
        ]
        read_only_fields = ['id', 'enrolled_at', 'completed_at', 'last_accessed']
    
    def get_course(self, obj):
        return {
            'id': obj.course.id,
            'title': obj.course.title,
            'slug': obj.course.slug,
            'thumbnail': obj.course.thumbnail.url if obj.course.thumbnail else None,
            'instructor': obj.course.instructor.get_full_name()
        }

class CourseListSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la liste des cours"""
    
    instructor = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    price_display = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    enrollment_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'short_description',
            'thumbnail', 'category', 'level', 'type', 'price_display',
            'original_price', 'currency', 'is_featured', 'is_premium',
            'duration', 'lessons_count', 'students_count', 'rating_average',
            'rating_count', 'completion_rate', 'instructor',
            'discount_percentage', 'enrollment_count', 'published_at'
        ]
    
    def get_instructor(self, obj):
        return {
            'id': obj.instructor.id,
            'name': obj.instructor.get_full_name(),
            'avatar': obj.instructor.get_avatar_url(),
            'is_verified': obj.instructor.is_verified
        }
    
    def get_price_display(self, obj):
        return obj.get_price_display()
    
    def get_discount_percentage(self, obj):
        return obj.get_discount_percentage()
    
    def get_enrollment_count(self, obj):
        """Retourne le nombre d'inscriptions actives"""
        return obj.enrollments.filter(status='ACTIVE').count()

class CourseDetailSerializer(serializers.ModelSerializer):
    """Sérialiseur détaillé pour un cours"""
    
    instructor = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)
    reviews = CourseReviewSerializer(many=True, read_only=True)
    price_display = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    enrollment_progress = serializers.SerializerMethodField()
    related_courses = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'description', 'short_description',
            'thumbnail', 'cover_image', 'preview_video', 'category', 'level',
            'type', 'tags', 'price', 'price_display', 'original_price',
            'currency', 'is_featured', 'is_premium', 'duration', 'lessons_count',
            'students_count', 'rating_average', 'rating_count', 'completion_rate',
            'instructor', 'co_instructors', 'status', 'published_at',
            'allow_reviews', 'allow_downloads', 'certificate_available',
            'max_students', 'meta_title', 'meta_description', 'keywords',
            'modules', 'reviews', 'discount_percentage', 'is_enrolled',
            'enrollment_progress', 'related_courses', 'created_at', 'updated_at'
        ]
    
    def get_instructor(self, obj):
        return {
            'id': obj.instructor.id,
            'name': obj.instructor.get_full_name(),
            'avatar': obj.instructor.get_avatar_url(),
            'bio': obj.instructor.bio,
            'is_verified': obj.instructor.is_verified,
            'rating_average': obj.instructor.rating_average,
            'total_students': obj.instructor.total_students
        }
    
    def get_price_display(self, obj):
        return obj.get_price_display()
    
    def get_discount_percentage(self, obj):
        return obj.get_discount_percentage()
    
    def get_is_enrolled(self, obj):
        """Vérifie si l'utilisateur actuel est inscrit au cours"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.enrollments.filter(
                user=request.user,
                status='ACTIVE'
            ).exists()
        return False
    
    def get_enrollment_progress(self, obj):
        """Retourne la progression de l'utilisateur dans le cours"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = obj.enrollments.filter(
                user=request.user,
                status='ACTIVE'
            ).first()
            if enrollment:
                return {
                    'progress': enrollment.progress,
                    'current_lesson': enrollment.current_lesson.id if enrollment.current_lesson else None,
                    'completed_lessons_count': enrollment.completed_lessons.count()
                }
        return None
    
    def get_related_courses(self, obj):
        """Retourne des cours similaires"""
        related = Course.objects.filter(
            category=obj.category,
            status='PUBLISHED'
        ).exclude(id=obj.id)[:6]
        
        return CourseListSerializer(related, many=True).data

class CourseCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un cours"""
    
    class Meta:
        model = Course
        fields = [
            'title', 'subtitle', 'description', 'short_description',
            'thumbnail', 'cover_image', 'preview_video', 'category',
            'level', 'type', 'tags', 'price', 'original_price',
            'currency', 'is_featured', 'is_premium', 'language',
            'allow_reviews', 'allow_downloads', 'certificate_available',
            'max_students', 'meta_title', 'meta_description', 'keywords'
        ]
    
    def create(self, validated_data):
        """Crée le cours avec l'instructeur actuel"""
        validated_data['instructor'] = self.context['request'].user
        return super().create(validated_data)

class CourseUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour mettre à jour un cours"""
    
    class Meta:
        model = Course
        fields = [
            'title', 'subtitle', 'description', 'short_description',
            'thumbnail', 'cover_image', 'preview_video', 'category',
            'level', 'type', 'tags', 'price', 'original_price',
            'currency', 'is_featured', 'is_premium', 'language',
            'allow_reviews', 'allow_downloads', 'certificate_available',
            'max_students', 'meta_title', 'meta_description', 'keywords'
        ]

class ModuleCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un module"""
    
    class Meta:
        model = Module
        fields = ['title', 'description', 'order', 'is_free']

class LessonCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer une leçon"""
    
    class Meta:
        model = Lesson
        fields = [
            'title', 'description', 'type', 'order', 'content',
            'video_url', 'video_duration', 'video_thumbnail',
            'resources', 'attachments', 'is_free', 'is_required',
            'estimated_duration'
        ]

class CourseSearchSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la recherche de cours"""
    
    instructor = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    price_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'short_description',
            'thumbnail', 'category', 'level', 'type', 'price_display',
            'duration', 'lessons_count', 'students_count', 'rating_average',
            'rating_count', 'instructor', 'published_at'
        ]
    
    def get_instructor(self, obj):
        return {
            'id': obj.instructor.id,
            'name': obj.instructor.get_full_name(),
            'avatar': obj.instructor.get_avatar_url()
        }
    
    def get_price_display(self, obj):
        return obj.get_price_display() 