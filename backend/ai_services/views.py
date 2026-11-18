from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from courses.models import Lesson
from courses.serializers import CourseListSerializer

from . import services
from .models import AIRequestLog


class AIThrottle(UserRateThrottle):
    """Limite les appels IA par utilisateur (THROTTLE_AI, 20/heure par défaut)."""
    scope = 'ai'


def _lesson_text(lesson):
    parts = [lesson.title, lesson.description, lesson.content, lesson.subtitles]
    return '\n\n'.join(p for p in parts if p)


def _is_owner(user, lesson):
    return user.role == 'ADMIN' or lesson.module.course.instructor_id == user.id


def _has_access(user, lesson):
    return _is_owner(user, lesson) or lesson.is_free or user.enrollments.filter(
        course=lesson.module.course, status__in=['ACTIVE', 'COMPLETED']).exists()


def _log(request, feature, ok=True):
    AIRequestLog.objects.create(user=request.user, feature=feature, success=ok, used_llm=services.llm_available())


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recommendations(request):
    courses = services.recommend_courses(request.user, limit=int(request.query_params.get('limit', 8)))
    return Response(CourseListSerializer(courses, many=True, context={'request': request}).data)


class QuizRequest(serializers.Serializer):
    num_questions = serializers.IntegerField(min_value=1, max_value=15, default=5)
    save = serializers.BooleanField(default=False)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AIThrottle])
def generate_quiz(request, lesson_id):
    """Génère un QCM à partir du contenu de la leçon (formateur). save=true l'enregistre sur la leçon."""
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=lesson_id)
    if not _is_owner(request.user, lesson):
        return Response({'error': 'Réservé au formateur du cours'}, status=status.HTTP_403_FORBIDDEN)
    params = QuizRequest(data=request.data)
    params.is_valid(raise_exception=True)
    questions = services.generate_quiz(_lesson_text(lesson), params.validated_data['num_questions'])
    _log(request, 'quiz', bool(questions))
    if not questions:
        return Response({'error': 'Contenu insuffisant pour générer un quiz.'}, status=status.HTTP_400_BAD_REQUEST)
    if params.validated_data['save']:
        lesson.quiz = questions
        lesson.save(update_fields=['quiz'])
    return Response({'questions': questions, 'saved': params.validated_data['save'],
                     'engine': 'openai' if services.llm_available() else 'local'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AIThrottle])
def summarize_lesson(request, lesson_id):
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=lesson_id)
    if not _has_access(request.user, lesson):
        return Response({'error': 'Inscription requise'}, status=status.HTTP_403_FORBIDDEN)
    if lesson.summary and not request.data.get('refresh'):
        return Response({'summary': lesson.summary, 'cached': True})
    summary = services.summarize(_lesson_text(lesson))
    _log(request, 'summary', bool(summary))
    if summary:  # mis en cache sur la leçon pour tous les apprenants
        lesson.summary = summary
        lesson.save(update_fields=['summary'])
    return Response({'summary': summary, 'cached': False})


class TutorRequest(serializers.Serializer):
    lesson_id = serializers.UUIDField()
    question = serializers.CharField(max_length=1000)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AIThrottle])
def tutor(request):
    params = TutorRequest(data=request.data)
    params.is_valid(raise_exception=True)
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=params.validated_data['lesson_id'])
    if not _has_access(request.user, lesson):
        return Response({'error': 'Inscription requise'}, status=status.HTTP_403_FORBIDDEN)
    answer = services.tutor_answer(params.validated_data['question'], _lesson_text(lesson), lesson.module.course.title)
    _log(request, 'tutor')
    return Response({'answer': answer, 'engine': 'openai' if services.llm_available() else 'local'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def moderate(request):
    text = str(request.data.get('text', ''))[:5000]
    return Response(services.moderate_text(text))


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def ai_status(request):
    return Response({'llm_enabled': services.llm_available(),
                     'model': services.settings.OPENAI_MODEL if services.llm_available() else None})
