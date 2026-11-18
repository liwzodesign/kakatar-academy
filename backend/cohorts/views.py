from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from courses.models import Course
from payments.models import Payment
from payments.services import PaymentError, start_item_checkout
from users.permissions import IsFormateurUser

from .models import Cohort, CohortMembership
from .services import confirm_membership


def _cohort_data(cohort, request):
    user = request.user
    membership = cohort.memberships.filter(user=user).first() if user.is_authenticated else None
    return {
        'id': str(cohort.id), 'title': cohort.title, 'description': cohort.description,
        'start_date': cohort.start_date, 'end_date': cohort.end_date, 'capacity': cohort.capacity,
        'members_count': cohort.members_count(), 'spots_left': cohort.spots_left(), 'price': cohort.price,
        'currency': cohort.currency, 'status': cohort.status, 'is_open': cohort.is_open(),
        'membership_status': membership.status if membership else None,
        'course': {'slug': cohort.course.slug, 'title': cohort.course.title},
        'sessions_count': cohort.live_sessions.exclude(status='CANCELLED').count(),
    }


class CohortSerializer(serializers.ModelSerializer):
    course_slug = serializers.SlugField(write_only=True)

    class Meta:
        model = Cohort
        fields = ['title', 'description', 'start_date', 'end_date', 'capacity', 'price', 'status', 'course_slug']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La fin doit suivre le début.'})
        if not self.instance and start and start < timezone.localdate():
            raise serializers.ValidationError({'start_date': 'La promotion doit commencer dans le futur.'})
        return attrs


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def course_cohorts(request, slug):
    """Promotions à venir ou en cours d'un cours (fiche du cours)."""
    course = get_object_or_404(Course, slug=slug)
    cohorts = course.cohorts.exclude(status=Cohort.Status.CANCELLED).filter(end_date__gte=timezone.localdate())
    return Response([_cohort_data(c, request) for c in cohorts])


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_cohorts(request):
    """GET : mes promotions. POST : créer une promotion pour un de mes cours."""
    if request.method == 'POST':
        ser = CohortSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        course = get_object_or_404(Course, slug=ser.validated_data.pop('course_slug'))
        if course.instructor_id != request.user.id and request.user.role != 'ADMIN':
            raise PermissionDenied('Ce cours ne vous appartient pas.')
        cohort = ser.save(course=course, currency=course.currency)
        return Response(_cohort_data(cohort, request), status=status.HTTP_201_CREATED)
    qs = Cohort.objects.select_related('course')
    if request.user.role != 'ADMIN':
        qs = qs.filter(course__instructor=request.user)
    return Response([_cohort_data(c, request) for c in qs.order_by('-start_date')])


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def cohort_detail(request, pk):
    cohort = get_object_or_404(Cohort.objects.select_related('course'), pk=pk)
    if cohort.course.instructor_id != request.user.id and request.user.role != 'ADMIN':
        raise PermissionDenied()
    if request.method == 'DELETE':
        cohort.status = Cohort.Status.CANCELLED
        cohort.save(update_fields=['status'])
        return Response(status=status.HTTP_204_NO_CONTENT)
    data = {k: v for k, v in request.data.items() if k != 'course_slug'}
    ser = CohortSerializer(cohort, data=data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(_cohort_data(cohort, request))


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def cohort_members(request, pk):
    cohort = get_object_or_404(Cohort.objects.select_related('course'), pk=pk)
    if cohort.course.instructor_id != request.user.id and request.user.role != 'ADMIN':
        raise PermissionDenied()
    members = cohort.memberships.filter(status=CohortMembership.Status.CONFIRMED).select_related('user')
    return Response([{'id': str(m.user_id), 'name': m.user.get_full_name(), 'email': m.user.email,
                      'joined_at': m.created_at} for m in members])


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def join_cohort(request, pk):
    """Rejoindre une promotion : gratuite → confirmation immédiate ; payante → URL de paiement."""
    with transaction.atomic():
        cohort = get_object_or_404(Cohort.objects.select_for_update().select_related('course__instructor'), pk=pk)
        if cohort.course.instructor_id == request.user.id:
            return Response({'error': 'Vous animez ce cours.'}, status=status.HTTP_400_BAD_REQUEST)
        membership = CohortMembership.objects.filter(cohort=cohort, user=request.user).first()
        if membership and membership.status == CohortMembership.Status.CONFIRMED:
            return Response({'error': 'Vous faites déjà partie de cette promotion.'}, status=status.HTTP_400_BAD_REQUEST)
        if not cohort.is_open():
            return Response({'error': 'Les inscriptions à cette promotion sont closes ou complètes.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if membership is None:
            membership = CohortMembership.objects.create(cohort=cohort, user=request.user)
        if cohort.price == 0:
            confirm_membership(membership)
            return Response({'checkout_url': None, 'status': 'CONFIRMED'}, status=status.HTTP_201_CREATED)
    gateway = request.data.get('gateway')
    if not gateway:
        return Response({'error': 'Choisissez un moyen de paiement.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        payment, url = start_item_checkout(
            request.user, Payment.Type.COHORT_ENROLLMENT, cohort.price, cohort.currency,
            f'Promotion : {cohort.course.title} — {cohort.title}', cohort.course.instructor,
            {'membership_id': str(membership.id), 'cohort_id': str(cohort.id)}, gateway)
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    membership.payment = payment
    membership.save(update_fields=['payment'])
    return Response({'checkout_url': url, 'payment_id': str(payment.id)}, status=status.HTTP_201_CREATED)
