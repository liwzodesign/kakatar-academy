from rest_framework import serializers
from django.db.models import Avg, Count
from .access import ACCESS_STATUSES, can_view_lesson, get_enrollment
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
    """Leçon : le contenu n'est renvoyé qu'aux personnes qui y ont accès"""

    duration_display = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()

    PROTECTED_FIELDS = ('content', 'video_url', 'resources', 'attachments')

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'description', 'type', 'order', 'content',
            'video_url', 'video_duration', 'video_thumbnail', 'resources',
            'attachments', 'is_free', 'is_required', 'estimated_duration',
            'status', 'duration_display', 'is_completed', 'is_locked'
        ]
        read_only_fields = ['id']

    def _enrollment(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        cache = self.context.setdefault('_enrollment_cache', {})
        course_id = obj.module.course_id
        if course_id not in cache:
            cache[course_id] = get_enrollment(request.user, obj.module.course)
        return cache[course_id]

    def get_duration_display(self, obj):
        return obj.get_duration_display()

    def get_is_completed(self, obj):
        enrollment = self._enrollment(obj)
        if enrollment:
            return enrollment.completed_lessons.filter(id=obj.id).exists()
        return False

    def get_is_locked(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        return not can_view_lesson(user, obj, self._enrollment(obj))

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if data.get('is_locked'):
            for field in self.PROTECTED_FIELDS:
                if field in data:
                    data[field] = [] if field in ('resources', 'attachments') else ''
        return data

class ModuleSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les modules"""
    
    lessons = serializers.SerializerMethodField()
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
    
    def get_lessons(self, obj):
        lessons = obj.lessons.filter(status=Lesson.Status.PUBLISHED).order_by('order')
        return LessonSerializer(lessons, many=True, context=self.context).data

    def get_lessons_count(self, obj):
        return obj.lessons.filter(status=Lesson.Status.PUBLISHED).count()

    def get_duration(self, obj):
        return obj.get_duration()
    
    def get_progress(self, obj):
        """Calcule la progression dans le module"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = get_enrollment(request.user, obj.course)
            if enrollment:
                completed_lessons = enrollment.completed_lessons.filter(module=obj).count()
                total_lessons = obj.lessons.filter(status=Lesson.Status.PUBLISHED).count()
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
            if not request.user.enrollments.filter(course=course, status__in=ACCESS_STATUSES).exists():
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
    current_lesson = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id', 'course', 'status', 'progress', 'completed_lessons',
            'current_lesson', 'enrolled_at', 'completed_at', 'last_accessed',
            'certificate_issued', 'certificate_issued_at', 'certificate_code'
        ]
        read_only_fields = fields
    
    def get_course(self, obj):
        return {
            'id': obj.course.id,
            'title': obj.course.title,
            'slug': obj.course.slug,
            'thumbnail': obj.course.thumbnail.url if obj.course.thumbnail else None,
            'instructor': obj.course.instructor.get_full_name(),
            'lessons_count': obj.course.lessons_count,
            'duration': obj.course.duration,
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
            'thumbnail', 'category', 'level', 'type', 'price', 'price_display',
            'original_price', 'currency', 'is_featured', 'is_premium',
            'duration', 'lessons_count', 'students_count', 'rating_average',
            'rating_count', 'completion_rate', 'instructor',
            'discount_percentage', 'enrollment_count', 'published_at', 'status'
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
    modules = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
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
    
    def get_modules(self, obj):
        return ModuleSerializer(obj.modules.order_by('order'), many=True, context=self.context).data

    def get_reviews(self, obj):
        reviews = obj.reviews.select_related('user')[:20]
        return CourseReviewSerializer(reviews, many=True, context=self.context).data

    def _enrollment(self, obj):
        request = self.context.get('request')
        return get_enrollment(request.user, obj) if request else None

    def get_is_enrolled(self, obj):
        """Vérifie si l'utilisateur actuel a accès au cours"""
        return self._enrollment(obj) is not None

    def get_enrollment_progress(self, obj):
        """Retourne la progression de l'utilisateur dans le cours"""
        enrollment = self._enrollment(obj)
        if enrollment:
            return {
                'id': str(enrollment.id),
                'status': enrollment.status,
                'progress': enrollment.progress,
                'current_lesson': enrollment.current_lesson_id,
                'completed_lessons': [str(i) for i in enrollment.completed_lessons.values_list('id', flat=True)],
                'certificate_issued': enrollment.certificate_issued,
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
            'currency', 'is_premium', 'language', 'status',
            'allow_reviews', 'allow_downloads', 'certificate_available',
            'max_students', 'meta_title', 'meta_description', 'keywords'
        ]
    
    def validate_title(self, value):
        return value.strip()

    def create(self, validated_data):
        """Crée le cours avec un slug unique"""
        from django.utils.text import slugify
        base = slugify(validated_data['title'])[:180] or 'cours'
        slug, i = base, 2
        while Course.objects.filter(slug=slug).exists():
            slug = f"{base}-{i}"
            i += 1
        validated_data['slug'] = slug
        return super().create(validated_data)

class CourseUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour mettre à jour un cours"""
    
    class Meta:
        model = Course
        fields = [
            'title', 'subtitle', 'description', 'short_description',
            'thumbnail', 'cover_image', 'preview_video', 'category',
            'level', 'type', 'tags', 'price', 'original_price',
            'currency', 'is_premium', 'language', 'status',
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