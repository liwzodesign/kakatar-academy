from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from courses.models import Course, Enrollment
from courses.serializers import CourseListSerializer

from .models import LearningPath, PathCourse


def _path_data(path, request, detailed=False):
    courses = path.ordered_courses()
    total = sum((c.price for c in courses), Decimal('0'))
    data = {
        'id': str(path.id), 'slug': path.slug, 'title': path.title, 'subtitle': path.subtitle,
        'description': path.description, 'thumbnail': path.thumbnail_url or (courses[0].get_thumbnail_url() if courses else ''),
        'level': path.level, 'price': path.price, 'currency': path.currency, 'status': path.status,
        'total_value': total, 'savings': max(total - path.price, Decimal('0')),
        'courses_count': len(courses), 'duration': sum(c.duration for c in courses),
        'creator': {'id': str(path.creator_id), 'name': path.creator.get_full_name()},
        'is_owner': request.user.is_authenticated and (path.creator_id == request.user.id or request.user.role == 'ADMIN'),
    }
    if detailed:
        enrolled = {}
        if request.user.is_authenticated:
            enrolled = {e.course_id: e for e in Enrollment.objects.filter(
                user=request.user, course__in=courses, status__in=['ACTIVE', 'COMPLETED'])}
        data['courses'] = [{**CourseListSerializer(c, context={'request': request}).data,
                            'enrolled': c.id in enrolled,
                            'progress': float(enrolled[c.id].progress) if c.id in enrolled else 0} for c in courses]
        data['owned_count'] = len(enrolled)
        data['progress'] = round(sum(float(e.progress) for e in enrolled.values()) / len(courses), 1) if courses else 0
    return data


class PathWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    subtitle = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    description = serializers.CharField()
    thumbnail_url = serializers.URLField(required=False, allow_blank=True, default='')
    level = serializers.ChoiceField(choices=Course.Level.choices, default=Course.Level.DEBUTANT)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))
    status = serializers.ChoiceField(choices=LearningPath.Status.choices, default=LearningPath.Status.DRAFT)
    course_slugs = serializers.ListField(child=serializers.SlugField(), min_length=2, max_length=20)

    def validate(self, attrs):
        user = self.context['request'].user
        slugs = attrs['course_slugs']
        if len(set(slugs)) != len(slugs):
            raise serializers.ValidationError({'course_slugs': 'Un cours ne peut figurer qu’une fois.'})
        courses = {c.slug: c for c in Course.objects.filter(slug__in=slugs, status=Course.Status.PUBLISHED)}
        if len(courses) != len(slugs):
            raise serializers.ValidationError({'course_slugs': 'Tous les cours doivent être publiés.'})
        if user.role != 'ADMIN' and any(c.instructor_id != user.id for c in courses.values()):
            raise serializers.ValidationError({'course_slugs': 'Vous ne pouvez regrouper que vos propres cours.'})
        total = sum((c.price for c in courses.values()), Decimal('0'))
        if attrs['price'] > total:
            raise serializers.ValidationError({'price': 'Le prix du parcours ne peut dépasser la somme des cours.'})
        attrs['courses'] = [courses[s] for s in slugs]
        return attrs


def _save_path(path, data):
    for field in ('title', 'subtitle', 'description', 'thumbnail_url', 'level', 'price', 'status'):
        setattr(path, field, data[field])
    path.save()
    path.path_courses.all().delete()
    PathCourse.objects.bulk_create([PathCourse(path=path, course=c, order=i) for i, c in enumerate(data['courses'])])
    return path


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def path_list(request):
    """GET : parcours publiés (?mine=true : les miens). POST : créer un parcours (formateur / admin)."""
    if request.method == 'POST':
        if not request.user.is_authenticated or request.user.role not in ('FORMATEUR', 'ADMIN'):
            raise PermissionDenied('Réservé aux formateurs.')
        ser = PathWriteSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            path = _save_path(LearningPath(creator=request.user), ser.validated_data)
        return Response(_path_data(path, request, detailed=True), status=status.HTTP_201_CREATED)

    qs = LearningPath.objects.select_related('creator').prefetch_related('path_courses__course')
    if request.query_params.get('mine') == 'true' and request.user.is_authenticated:
        qs = qs.filter(creator=request.user).exclude(status=LearningPath.Status.ARCHIVED)
    else:
        qs = qs.filter(status=LearningPath.Status.PUBLISHED)
    return Response([_path_data(p, request) for p in qs[:100]])


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.AllowAny])
def path_detail(request, slug):
    user = request.user
    qs = LearningPath.objects.select_related('creator')
    if not (user.is_authenticated and user.role == 'ADMIN'):
        visible = Q(status=LearningPath.Status.PUBLISHED)
        if user.is_authenticated:
            visible |= Q(creator=user)
        qs = qs.filter(visible)
    path = get_object_or_404(qs, slug=slug)
    if request.method == 'GET':
        return Response(_path_data(path, request, detailed=True))
    if not user.is_authenticated or (path.creator_id != user.id and user.role != 'ADMIN'):
        raise PermissionDenied()
    if request.method == 'DELETE':
        path.status = LearningPath.Status.ARCHIVED
        path.save(update_fields=['status'])
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = PathWriteSerializer(data=request.data, context={'request': request})
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        _save_path(path, ser.validated_data)
    return Response(_path_data(path, request, detailed=True))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def path_enroll(request, slug):
    """Parcours gratuit : inscription directe à tous ses cours. Parcours payant : renvoie l'URL de paiement."""
    from payments.services import PaymentError, start_path_checkout
    from courses.views import enroll_user

    path = get_object_or_404(LearningPath, slug=slug, status=LearningPath.Status.PUBLISHED)
    courses = path.ordered_courses()
    if path.price == 0:
        for course in courses:
            if course.instructor_id != request.user.id:
                enroll_user(request.user, course)
        return Response({'checkout_url': None, 'enrolled': True}, status=status.HTTP_201_CREATED)
    gateway = request.data.get('gateway')
    if not gateway:
        return Response({'error': 'Choisissez un moyen de paiement.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        payment, url = start_path_checkout(request.user, path, gateway, request.data.get('coupon_code', ''))
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'checkout_url': url, 'payment_id': str(payment.id)}, status=status.HTTP_201_CREATED)
