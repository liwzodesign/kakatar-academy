from django.utils import timezone
from rest_framework import serializers

from cohorts.models import Cohort
from courses.models import Category, Course

from .models import LiveSession, SessionRegistration


class LiveSessionSerializer(serializers.ModelSerializer):
    instructor = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    course_title = serializers.CharField(source='course.title', read_only=True, default='')
    registrations_count = serializers.SerializerMethodField()
    spots_left = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    registration_status = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    end_at = serializers.DateTimeField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=False, allow_null=True)
    cohort = serializers.PrimaryKeyRelatedField(queryset=Cohort.objects.all(),
                                                required=False, allow_null=True)
    cohort_title = serializers.CharField(source='cohort.title', read_only=True, default='')

    class Meta:
        model = LiveSession
        fields = [
            'id', 'title', 'description', 'instructor', 'course', 'course_title', 'category', 'category_name',
            'level', 'type', 'start_at', 'end_at', 'duration', 'location', 'capacity', 'price', 'currency', 'status',
            'recording_url', 'registrations_count', 'spots_left', 'is_registered', 'registration_status',
            'is_owner', 'meeting_url', 'created_at', 'cohort', 'cohort_title',
        ]
        read_only_fields = ['id', 'status', 'created_at']
        extra_kwargs = {'meeting_url': {'required': False}}

    def get_instructor(self, obj):
        user = obj.instructor
        return {'id': str(user.id), 'name': user.get_full_name(), 'avatar': user.get_avatar_url(),
                'bio': user.bio, 'rating': float(user.rating_average)}

    def get_registrations_count(self, obj):
        return obj.confirmed_count()

    def get_spots_left(self, obj):
        return obj.spots_left()

    def _registration(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return obj.registrations.filter(user=request.user).first()

    def get_is_registered(self, obj):
        reg = self._registration(obj)
        return bool(reg and reg.status in ('CONFIRMED', 'ATTENDED'))

    def get_registration_status(self, obj):
        reg = self._registration(obj)
        return reg.status if reg else None

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.instructor_id == request.user.id)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Le lien de visio n'est visible que par l'animateur et les inscrits confirmés
        if not (data['is_owner'] or data['is_registered']):
            data['meeting_url'] = ''
        return data

    def validate_start_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('La session doit être programmée dans le futur.')
        return value

    def validate(self, attrs):
        session_type = attrs.get('type', getattr(self.instance, 'type', LiveSession.Type.ONLINE))
        location = attrs.get('location', getattr(self.instance, 'location', ''))
        if session_type in (LiveSession.Type.PRESENTIAL, LiveSession.Type.HYBRID) and not location:
            raise serializers.ValidationError({'location': 'Le lieu est obligatoire pour une session en présentiel.'})
        return attrs


class RegistrationCreateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    company = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    experience = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    expectations = serializers.CharField(required=False, allow_blank=True, default='')
    gateway = serializers.ChoiceField(choices=['STRIPE', 'PAYDUNYA', 'WAVE', 'MOBILE_MONEY'], required=False)


class RegistrationSerializer(serializers.ModelSerializer):
    session = LiveSessionSerializer(read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = SessionRegistration
        fields = ['id', 'session', 'user', 'status', 'phone', 'company', 'experience', 'expectations', 'created_at']
        read_only_fields = fields

    def get_user(self, obj):
        return {'id': str(obj.user.id), 'name': obj.user.get_full_name(), 'email': obj.user.email}
