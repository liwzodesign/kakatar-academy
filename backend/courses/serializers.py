from rest_framework import serializers

from .models import (
    Category, Certificate, Course, CourseReview, Enrollment, Lesson, Module, QuizAttempt,
)


def _user_can_access_course(request, course):
    """True si l'utilisateur est l'auteur, un admin ou un étudiant inscrit."""
    if not request or not request.user.is_authenticated:
        return False
    user = request.user
    if user.role == 'ADMIN' or course.instructor_id == user.id:
        return True
    cache = getattr(request, '_enrolled_course_ids', None)
    if cache is None:
        cache = set(user.enrollments.filter(status__in=['ACTIVE', 'COMPLETED']).values_list('course_id', flat=True))
        request._enrolled_course_ids = cache
    return course.id in cache


def _instructor_summary(user, detailed=False):
    data = {
        'id': str(user.id),
        'name': user.get_full_name(),
        'avatar': user.get_avatar_url(),
        'is_verified': user.is_verified,
    }
    if detailed:
        data.update({
            'bio': user.bio,
            'rating_average': float(user.rating_average),
            'total_students': user.total_students,
            'total_courses': user.total_courses_created,
        })
    return data


class CategorySerializer(serializers.ModelSerializer):
    courses_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'icon', 'color', 'parent', 'is_active', 'order',
                  'courses_count']
        read_only_fields = ['slug']

    def get_courses_count(self, obj):
        return obj.courses.filter(status=Course.Status.PUBLISHED).count()


class LessonSerializer(serializers.ModelSerializer):
    """Leçon vue par un apprenant : le contenu n'est livré que si l'accès est autorisé."""

    duration_display = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    locked = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    quiz = serializers.SerializerMethodField()
    module_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id', 'module_id', 'title', 'description', 'type', 'order', 'content', 'video_url',
            'video_duration', 'video_status', 'resources', 'attachments', 'is_free', 'is_required',
            'estimated_duration', 'status', 'duration_display', 'is_completed', 'locked', 'quiz',
            'passing_score', 'summary', 'subtitles',
        ]

    def _has_access(self, obj):
        if obj.is_free or obj.module.is_free:
            return True
        return _user_can_access_course(self.context.get('request'), obj.module.course)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if not self._has_access(obj):
            for field in ('content', 'resources', 'attachments', 'summary', 'subtitles'):
                data[field] = [] if field in ('resources', 'attachments') else ''
        return data

    def get_locked(self, obj):
        return not self._has_access(obj)

    def get_video_url(self, obj):
        if not self._has_access(obj):
            return ''
        request = self.context.get('request')
        return obj.get_video_url(request.user if request else None)

    def get_quiz(self, obj):
        """Les questions sont envoyées sans les bonnes réponses."""
        if not self._has_access(obj):
            return []
        return [{'question': q.get('question', ''), 'options': q.get('options', [])} for q in (obj.quiz or [])]

    def get_duration_display(self, obj):
        return obj.get_duration_display()

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        cache = getattr(request, '_completed_lesson_ids', None)
        if cache is None:
            cache = set(Lesson.objects.filter(
                completions__user=request.user).values_list('id', flat=True))
            request._completed_lesson_ids = cache
        return obj.id in cache


class LessonWriteSerializer(serializers.ModelSerializer):
    """Création / édition d'une leçon par le formateur (accès à toutes les données)."""

    playback_url = serializers.SerializerMethodField()

    def get_playback_url(self, obj):
        request = self.context.get('request')
        return obj.get_video_url(request.user if request else None)

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'description', 'type', 'order', 'content', 'video_url', 'video_duration',
            'video_thumbnail', 'resources', 'attachments', 'is_free', 'is_required', 'estimated_duration',
            'status', 'quiz', 'passing_score', 'summary', 'video_status', 'playback_url',
        ]
        read_only_fields = ['id', 'video_status']
        extra_kwargs = {'order': {'required': False}}

    def validate_quiz(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Le quiz doit être une liste de questions.')
        for i, q in enumerate(value):
            options = q.get('options') if isinstance(q, dict) else None
            if not isinstance(q, dict) or not q.get('question') or not isinstance(options, list) or len(options) < 2:
                raise serializers.ValidationError(f'Question {i + 1} invalide (question + 2 options minimum).')
            if not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(options):
                raise serializers.ValidationError(f'Question {i + 1} : index de bonne réponse invalide.')
        return value


class ModuleSerializer(serializers.ModelSerializer):
    lessons = serializers.SerializerMethodField()
    lessons_count = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ['id', 'title', 'description', 'order', 'is_free', 'lessons', 'lessons_count', 'duration']

    def _lessons(self, obj):
        lessons = obj.lessons.all()
        if not self.context.get('include_drafts'):
            lessons = [lesson for lesson in lessons if lesson.status == Lesson.Status.PUBLISHED]
        return lessons

    def get_lessons(self, obj):
        serializer = LessonWriteSerializer if self.context.get('include_drafts') else LessonSerializer
        return serializer(self._lessons(obj), many=True, context=self.context).data

    def get_lessons_count(self, obj):
        return len(self._lessons(obj))

    def get_duration(self, obj):
        return sum(lesson.get_minutes() for lesson in self._lessons(obj))


class ModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'title', 'description', 'order', 'is_free']
        read_only_fields = ['id']
        extra_kwargs = {'order': {'required': False}}


class CourseReviewSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = CourseReview
        fields = ['id', 'user', 'rating', 'title', 'comment', 'created_at', 'updated_at', 'is_verified',
                  'instructor_reply', 'replied_at']
        read_only_fields = fields

    def get_user(self, obj):
        return {'id': str(obj.user.id), 'name': obj.user.get_full_name(), 'avatar': obj.user.get_avatar_url()}


class CourseReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseReview
        fields = ['rating', 'title', 'comment']

    def validate(self, attrs):
        request = self.context['request']
        course = self.context['course']
        if not course.allow_reviews:
            raise serializers.ValidationError('Les avis sont désactivés pour ce cours.')
        if not request.user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).exists():
            raise serializers.ValidationError('Vous devez être inscrit au cours pour laisser un avis.')
        if CourseReview.objects.filter(user=request.user, course=course).exists():
            raise serializers.ValidationError('Vous avez déjà laissé un avis pour ce cours.')
        return attrs


class CourseListSerializer(serializers.ModelSerializer):
    instructor = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    thumbnail = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'short_description', 'description', 'thumbnail', 'category',
            'level', 'type', 'price', 'price_display', 'original_price', 'currency', 'is_featured',
            'is_premium', 'duration', 'lessons_count', 'students_count', 'rating_average', 'rating_count',
            'completion_rate', 'instructor', 'discount_percentage', 'status', 'published_at', 'created_at',
            'updated_at', 'tags', 'language',
        ]

    def get_instructor(self, obj):
        return _instructor_summary(obj.instructor)

    def get_thumbnail(self, obj):
        url = obj.get_thumbnail_url()
        request = self.context.get('request')
        if url and url.startswith('/') and request:
            return request.build_absolute_uri(url)
        return url

    def get_price_display(self, obj):
        return obj.get_price_display()

    def get_discount_percentage(self, obj):
        return obj.get_discount_percentage()


class CourseDetailSerializer(CourseListSerializer):
    instructor = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    enrollment = serializers.SerializerMethodField()
    related_courses = serializers.SerializerMethodField()

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + [
            'objectives', 'requirements', 'cover_image', 'preview_video', 'allow_reviews', 'allow_downloads',
            'certificate_available', 'max_students', 'meta_title', 'meta_description', 'keywords',
            'modules', 'reviews', 'is_enrolled', 'is_favorite', 'is_owner', 'enrollment', 'related_courses',
            'category_id',
        ]

    category_id = serializers.IntegerField(source='category.id', read_only=True)

    def get_instructor(self, obj):
        return _instructor_summary(obj.instructor, detailed=True)

    def get_modules(self, obj):
        context = dict(self.context)
        context['include_drafts'] = self.get_is_owner(obj)
        return ModuleSerializer(obj.modules.all(), many=True, context=context).data

    def get_reviews(self, obj):
        return CourseReviewSerializer(obj.reviews.filter(is_hidden=False)[:10], many=True).data

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.enrollments.filter(
            user=request.user, status__in=['ACTIVE', 'COMPLETED']).exists())

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.favorited_by.filter(
            user=request.user).exists())

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and (
            obj.instructor_id == request.user.id or request.user.role == 'ADMIN'))

    def get_enrollment(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        enrollment = obj.enrollments.filter(user=request.user).first()
        if not enrollment:
            return None
        return {
            'id': str(enrollment.id),
            'status': enrollment.status,
            'progress': float(enrollment.progress),
            'current_lesson': str(enrollment.current_lesson_id) if enrollment.current_lesson_id else None,
            'completed_lessons': [str(i) for i in enrollment.completed_lessons.values_list('id', flat=True)],
            'certificate_code': getattr(getattr(enrollment, 'certificate', None), 'code', None),
        }

    def get_related_courses(self, obj):
        related = Course.objects.filter(category=obj.category, status=Course.Status.PUBLISHED) \
            .exclude(id=obj.id).select_related('instructor', 'category')[:4]
        return CourseListSerializer(related, many=True, context=self.context).data


class CourseWriteSerializer(serializers.ModelSerializer):
    """Création / mise à jour d'un cours par son formateur."""

    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.filter(is_active=True))

    class Meta:
        model = Course
        fields = [
            'id', 'slug', 'title', 'subtitle', 'description', 'short_description', 'objectives', 'requirements',
            'thumbnail', 'thumbnail_url', 'cover_image', 'preview_video', 'category', 'level', 'type', 'tags',
            'price', 'original_price', 'currency', 'is_premium', 'language', 'allow_reviews',
            'allow_downloads', 'certificate_available', 'max_students', 'meta_title', 'meta_description',
            'keywords', 'status', 'scheduled_at',
        ]
        read_only_fields = ['id', 'slug']

    def validate_status(self, value):
        request = self.context['request']
        if value == Course.Status.PUBLISHED and not request.user.can_create_courses() \
                and request.user.role != 'ADMIN':
            raise serializers.ValidationError('Seuls les formateurs vérifiés peuvent publier.')
        return value

    def validate(self, attrs):
        course_type = attrs.get('type', getattr(self.instance, 'type', Course.Type.PAID))
        price = attrs.get('price', getattr(self.instance, 'price', 0))
        if course_type == Course.Type.PAID and price <= 0:
            raise serializers.ValidationError({'price': 'Un cours payant doit avoir un prix positif.'})
        return attrs


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    completed_lessons = serializers.SerializerMethodField()
    certificate_code = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'course', 'status', 'progress', 'completed_lessons', 'current_lesson', 'enrolled_at',
            'completed_at', 'last_accessed', 'certificate_issued', 'certificate_issued_at', 'certificate_code',
        ]
        read_only_fields = fields

    def get_completed_lessons(self, obj):
        return [str(i) for i in obj.completed_lessons.values_list('id', flat=True)]

    def get_certificate_code(self, obj):
        cert = getattr(obj, 'certificate', None)
        return cert.code if cert else None


class QuizSubmitSerializer(serializers.Serializer):
    answers = serializers.ListField(child=serializers.IntegerField(min_value=-1))


class QuizAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = ['id', 'score', 'passed', 'answers', 'created_at']


class CertificateSerializer(serializers.ModelSerializer):
    student = serializers.CharField(source='enrollment.user.get_full_name', read_only=True)
    course_title = serializers.CharField(source='enrollment.course.title', read_only=True)
    course_slug = serializers.CharField(source='enrollment.course.slug', read_only=True)
    instructor = serializers.CharField(source='enrollment.course.instructor.get_full_name', read_only=True)
    duration = serializers.IntegerField(source='enrollment.course.duration', read_only=True)

    class Meta:
        model = Certificate
        fields = ['id', 'code', 'issued_at', 'student', 'course_title', 'course_slug', 'instructor', 'duration']
