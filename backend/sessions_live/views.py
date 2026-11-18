from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from payments.models import Payment
from payments.services import PaymentError, start_item_checkout
from users.permissions import IsFormateurUser
from notifications.services import notify

from .models import LiveSession, SessionRegistration
from .serializers import LiveSessionSerializer, RegistrationCreateSerializer, RegistrationSerializer
from .services import send_confirmation


def _visible_sessions(qs, user):
    """Les sessions de promotion ne sont visibles que de leurs membres, de l'animateur et des admins."""
    from django.db.models import Q
    if user.is_authenticated and user.role == 'ADMIN':
        return qs
    if not user.is_authenticated:
        return qs.filter(cohort__isnull=True)
    return qs.filter(Q(cohort__isnull=True) | Q(instructor=user)
                     | Q(cohort__memberships__user=user, cohort__memberships__status='CONFIRMED')).distinct()


class SessionListView(generics.ListAPIView):
    """Sessions à venir (filtres : type, level, category, search, past=true)."""
    serializer_class = LiveSessionSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['type', 'level', 'category', 'instructor']
    search_fields = ['title', 'description', 'location', 'instructor__first_name', 'instructor__last_name']
    ordering_fields = ['start_at', 'price']
    ordering = ['start_at']

    def get_queryset(self):
        qs = LiveSession.objects.exclude(status=LiveSession.Status.CANCELLED) \
            .select_related('instructor', 'category', 'course', 'cohort')
        qs = _visible_sessions(qs, self.request.user)
        if self.request.query_params.get('past') == 'true':
            return qs.filter(start_at__lt=timezone.now()).order_by('-start_at')
        return qs.filter(start_at__gte=timezone.now() - timezone.timedelta(hours=3))


class SessionCreateView(generics.CreateAPIView):
    serializer_class = LiveSessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]

    def perform_create(self, serializer):
        from cohorts.services import register_cohort_to_session
        course = serializer.validated_data.get('course')
        cohort = serializer.validated_data.get('cohort')
        if course and course.instructor_id != self.request.user.id:
            raise PermissionDenied('Ce cours ne vous appartient pas.')
        if cohort and cohort.course.instructor_id != self.request.user.id and self.request.user.role != 'ADMIN':
            raise PermissionDenied('Cette promotion ne vous appartient pas.')
        extra = {'course': cohort.course, 'price': 0} if cohort else {}  # déjà inclus dans le prix de la promotion
        session = serializer.save(instructor=self.request.user, **extra)
        register_cohort_to_session(session)


class SessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LiveSessionSerializer
    queryset = LiveSession.objects.select_related('instructor', 'category', 'course', 'cohort')

    def get_queryset(self):
        return _visible_sessions(super().get_queryset(), self.request.user)

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsFormateurUser()]

    def get_object(self):
        session = super().get_object()
        if self.request.method not in permissions.SAFE_METHODS and session.instructor_id != self.request.user.id \
                and self.request.user.role != 'ADMIN':
            raise PermissionDenied("Vous n'animez pas cette session.")
        return session

    def perform_destroy(self, instance):
        """Annule la session et prévient les inscrits (les remboursements se font via l'admin)."""
        from users.emails import send_templated_email
        instance.status = LiveSession.Status.CANCELLED
        instance.save(update_fields=['status'])
        for reg in instance.registrations.filter(status=SessionRegistration.Status.CONFIRMED).select_related('user'):
            notify(reg.user, 'SESSION', f'Session annulée : {instance.title}', '', '/sessions')
            send_templated_email(f'Session annulée : {instance.title}', 'emails/session_cancelled.html',
                                 {'user': reg.user, 'session': instance}, [reg.user.email])


class InstructorSessionListView(generics.ListAPIView):
    serializer_class = LiveSessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_queryset(self):
        return LiveSession.objects.filter(instructor=self.request.user).select_related('instructor', 'category') \
            .order_by('-start_at')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def register_to_session(request, pk):
    """
    Réserve une place. Session gratuite : confirmation immédiate.
    Session payante : renvoie l'URL de paiement (champ « gateway » requis).
    """
    session = get_object_or_404(LiveSession, pk=pk)
    if session.instructor_id == request.user.id:
        return Response({'error': 'Vous animez cette session.'}, status=status.HTTP_400_BAD_REQUEST)
    if session.cohort_id:
        return Response({'error': 'Session réservée aux membres de la promotion : rejoignez la promotion depuis la page du cours.'},
                        status=status.HTTP_400_BAD_REQUEST)
    serializer = RegistrationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    gateway = data.pop('gateway', None)

    with transaction.atomic():
        registration = SessionRegistration.objects.select_for_update().filter(session=session, user=request.user).first()
        if registration and registration.status in ('CONFIRMED', 'ATTENDED'):
            return Response({'error': 'Vous êtes déjà inscrit.'}, status=status.HTTP_400_BAD_REQUEST)
        if not session.is_open_for_registration():
            return Response({'error': 'Les inscriptions sont closes ou la session est complète.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if registration is None:
            registration = SessionRegistration(session=session, user=request.user)
        for field, value in data.items():
            setattr(registration, field, value)

        if session.price == 0:
            registration.status = SessionRegistration.Status.CONFIRMED
            registration.save()
            transaction.on_commit(lambda: send_confirmation(registration))
            return Response({'registration': RegistrationSerializer(registration, context={'request': request}).data,
                             'checkout_url': None}, status=status.HTTP_201_CREATED)

        if not gateway:
            return Response({'error': 'Choisissez un moyen de paiement (gateway).'},
                            status=status.HTTP_400_BAD_REQUEST)
        registration.status = SessionRegistration.Status.PENDING_PAYMENT
        registration.save()

    try:
        payment, url = start_item_checkout(
            request.user, Payment.Type.SESSION_BOOKING, session.price, session.currency,
            f'Session : {session.title}', session.instructor,
            {'registration_id': str(registration.id), 'session_id': str(session.id)}, gateway)
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    registration.payment = payment
    registration.save(update_fields=['payment'])
    return Response({'registration': RegistrationSerializer(registration, context={'request': request}).data,
                     'payment_id': str(payment.id), 'checkout_url': url}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_registration(request, pk):
    registration = get_object_or_404(SessionRegistration, session_id=pk, user=request.user)
    if registration.session.start_at - timezone.now() < timezone.timedelta(hours=24) \
            and registration.status == SessionRegistration.Status.CONFIRMED and registration.session.price > 0:
        return Response({'error': "Annulation impossible moins de 24 h avant une session payante."},
                        status=status.HTTP_400_BAD_REQUEST)
    registration.status = SessionRegistration.Status.CANCELLED
    registration.save(update_fields=['status'])
    return Response({'message': 'Inscription annulée'})


class MyRegistrationsView(generics.ListAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return SessionRegistration.objects.filter(user=self.request.user) \
            .exclude(status=SessionRegistration.Status.CANCELLED) \
            .select_related('session__instructor', 'session__category').order_by('session__start_at')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def join_session(request, pk):
    """Renvoie le lien de visio aux inscrits confirmés, 15 min avant le début et jusqu'à la fin."""
    session = get_object_or_404(LiveSession, pk=pk)
    is_owner = session.instructor_id == request.user.id
    registration = session.registrations.filter(user=request.user,
                                                status__in=['CONFIRMED', 'ATTENDED']).first()
    if not (is_owner or registration):
        return Response({'error': 'Inscription requise'}, status=status.HTTP_403_FORBIDDEN)
    if session.type == LiveSession.Type.PRESENTIAL:
        return Response({'error': 'Session en présentiel', 'location': session.location},
                        status=status.HTTP_400_BAD_REQUEST)
    if not is_owner and not session.can_join_now():
        return Response({'error': 'La salle ouvre 15 minutes avant le début.', 'start_at': session.start_at},
                        status=status.HTTP_400_BAD_REQUEST)
    if is_owner and session.status == LiveSession.Status.SCHEDULED and session.can_join_now():
        session.status = LiveSession.Status.LIVE
        session.save(update_fields=['status'])
    if registration and registration.status == SessionRegistration.Status.CONFIRMED:
        registration.status = SessionRegistration.Status.ATTENDED
        registration.save(update_fields=['status'])
    return Response({'meeting_url': session.meeting_url})


class SessionAttendeesView(generics.ListAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_queryset(self):
        session = get_object_or_404(LiveSession, pk=self.kwargs['pk'])
        if session.instructor_id != self.request.user.id and self.request.user.role != 'ADMIN':
            raise PermissionDenied()
        return session.registrations.exclude(status__in=['CANCELLED', 'PENDING_PAYMENT']).select_related('user')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def complete_session(request, pk):
    """L'animateur clôture la session (et peut ajouter le lien de l'enregistrement)."""
    session = get_object_or_404(LiveSession, pk=pk, instructor=request.user)
    session.status = LiveSession.Status.COMPLETED
    session.recording_url = request.data.get('recording_url', session.recording_url) or ''
    session.save(update_fields=['status', 'recording_url'])
    return Response(LiveSessionSerializer(session, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def session_calendar(request, pk):
    """Fichier .ics de la session (Google Agenda, Outlook, Apple Calendrier…).
    Le lien de visioconférence n'y figure pas : il reste réservé aux inscrits."""
    from datetime import timezone as dt_timezone

    from django.conf import settings
    from django.http import HttpResponse

    session = get_object_or_404(LiveSession.objects.select_related('instructor'), pk=pk)

    def esc(text):
        """Échappement RFC 5545 des valeurs texte."""
        return (text or '').replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')

    def fold(line):
        # RFC 5545 : lignes de 75 octets maximum, continuation par une espace
        out, raw = [], line.encode('utf-8')
        while len(raw) > 75:
            cut = 75
            while (raw[cut] & 0xC0) == 0x80:  # ne pas couper un caractère UTF-8
                cut -= 1
            out.append(raw[:cut].decode('utf-8'))
            raw = b' ' + raw[cut:]
        out.append(raw.decode('utf-8'))
        return '\r\n'.join(out)

    fmt = '%Y%m%dT%H%M%SZ'
    url = f"{settings.FRONTEND_URL.rstrip('/')}/sessions/{session.id}"
    where = session.location if session.type != LiveSession.Type.ONLINE else 'En ligne — lien sur Kakatar Academy'
    lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kakatar Academy//Sessions//FR', 'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH', 'BEGIN:VEVENT',
        f'UID:{session.id}@kakataracademy',
        f"DTSTAMP:{timezone.now().astimezone(dt_timezone.utc).strftime(fmt)}",
        f"DTSTART:{session.start_at.astimezone(dt_timezone.utc).strftime(fmt)}",
        f"DTEND:{session.end_at.astimezone(dt_timezone.utc).strftime(fmt)}",
        f'SUMMARY:{esc(session.title)}',
        'DESCRIPTION:' + esc(f'{session.description[:800]}\n\nAnimée par {session.instructor.get_full_name()}\n{url}'),
        f'LOCATION:{esc(where)}',
        f'URL:{url}',
        'STATUS:CANCELLED' if session.status == LiveSession.Status.CANCELLED else 'STATUS:CONFIRMED',
        'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', f'DESCRIPTION:{esc(session.title)}', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
    ]
    response = HttpResponse('\r\n'.join(fold(l) for l in lines) + '\r\n', content_type='text/calendar; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="session-kakatar-{str(session.id)[:8]}.ics"'
    return response
