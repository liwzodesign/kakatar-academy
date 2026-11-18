import mimetypes
import os

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from courses.models import Lesson
from courses.views import GRADED_TYPES, complete_lesson_for
from notifications.services import notify
from users.permissions import IsFormateurUser

from .models import Submission

MAX_FILE_SIZE = 25 * 1024 * 1024


class SubmissionSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    course_title = serializers.CharField(source='lesson.module.course.title', read_only=True)
    course_slug = serializers.CharField(source='lesson.module.course.slug', read_only=True)
    has_file = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Submission
        fields = ['id', 'lesson', 'lesson_title', 'course_title', 'course_slug', 'student', 'text', 'link', 'has_file',
                  'file_name', 'status', 'status_display', 'grade', 'feedback', 'reviewed_at', 'attempts', 'created_at',
                  'updated_at']

    def get_student(self, obj):
        return {'id': str(obj.user_id), 'name': obj.user.get_full_name(), 'email': obj.user.email,
                'avatar': obj.user.get_avatar_url()}

    def get_has_file(self, obj):
        return bool(obj.file)

    def get_file_name(self, obj):
        return os.path.basename(obj.file.name) if obj.file else ''


def _graded_lesson(lesson_id):
    lesson = get_object_or_404(Lesson.objects.select_related('module__course'), id=lesson_id)
    if lesson.type not in GRADED_TYPES:
        raise serializers.ValidationError("Cette leçon n'attend pas de travail à rendre.")
    return lesson


def _is_staff_of(user, course):
    return user.role == 'ADMIN' or course.instructor_id == user.id


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def my_submission(request, lesson_id):
    """GET : mon rendu pour la leçon (ou null). POST : rendre / remplacer mon travail (texte, lien, fichier)."""
    lesson = _graded_lesson(lesson_id)
    course = lesson.module.course
    enrollment = request.user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).first()
    if not enrollment:
        raise PermissionDenied('Vous devez être inscrit au cours.')
    submission = Submission.objects.filter(lesson=lesson, user=request.user).first()

    if request.method == 'GET':
        return Response(SubmissionSerializer(submission).data if submission else None)

    if submission and submission.status == Submission.Status.APPROVED:
        return Response({'error': 'Ce travail est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
    text = (request.data.get('text') or '').strip()
    link = (request.data.get('link') or '').strip()
    upload = request.FILES.get('file')
    if upload and upload.size > MAX_FILE_SIZE:
        return Response({'error': 'Fichier trop volumineux (25 Mo maximum).'}, status=status.HTTP_400_BAD_REQUEST)
    if not (text or link or upload or (submission and submission.file)):
        return Response({'error': 'Ajoutez une réponse, un lien ou un fichier.'}, status=status.HTTP_400_BAD_REQUEST)
    if link:
        serializers.URLField().run_validation(link)

    if submission is None:
        submission = Submission(lesson=lesson, user=request.user)
    else:
        submission.attempts += 1
    submission.text, submission.link = text, link
    if upload:
        submission.file = upload
    submission.status = Submission.Status.SUBMITTED
    submission.save()

    notify(course.instructor, 'COURSE', f'Nouveau travail à corriger : {lesson.title}',
           f'{request.user.get_full_name()} — {course.title}', '/assignments')
    return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_submissions(request):
    """Travaux rendus sur les cours du formateur (?status=SUBMITTED par défaut, ?status=ALL pour tout)."""
    qs = Submission.objects.select_related('user', 'lesson__module__course')
    if request.user.role != 'ADMIN':
        qs = qs.filter(lesson__module__course__instructor=request.user)
    wanted = request.query_params.get('status', 'SUBMITTED')
    if wanted != 'ALL':
        qs = qs.filter(status=wanted)
    return Response(SubmissionSerializer(qs.order_by('updated_at' if wanted == 'SUBMITTED' else '-updated_at')[:200],
                                         many=True).data)


class ReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Submission.Status.APPROVED, Submission.Status.NEEDS_REVISION])
    grade = serializers.IntegerField(min_value=0, max_value=100, required=False, allow_null=True)
    feedback = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs['status'] == Submission.Status.NEEDS_REVISION and not attrs.get('feedback'):
            raise serializers.ValidationError({'feedback': 'Expliquez ce qui doit être repris.'})
        return attrs


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def review_submission(request, pk):
    """Correction : valider (la leçon est alors validée pour l'étudiant) ou demander une reprise."""
    submission = get_object_or_404(Submission.objects.select_related('user', 'lesson__module__course'), pk=pk)
    course = submission.course
    if not _is_staff_of(request.user, course):
        raise PermissionDenied()
    data = ReviewSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    submission.status = data.validated_data['status']
    submission.grade = data.validated_data.get('grade')
    submission.feedback = data.validated_data['feedback']
    submission.reviewed_by = request.user
    submission.reviewed_at = timezone.now()
    submission.save()

    link = f'/learn/{course.slug}?lesson={submission.lesson_id}'
    if submission.status == Submission.Status.APPROVED:
        enrollment = submission.user.enrollments.filter(course=course).first()
        if enrollment:
            complete_lesson_for(enrollment, submission.lesson)
        notify(submission.user, 'COURSE', f'Travail validé ✅ : {submission.lesson.title}',
               (f'Note : {submission.grade}/100. ' if submission.grade is not None else '') + submission.feedback[:150], link)
    else:
        notify(submission.user, 'COURSE', f'Travail à reprendre : {submission.lesson.title}', submission.feedback[:200], link)
    return Response(SubmissionSerializer(submission).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def submission_file(request, pk):
    """Téléchargement du fichier rendu : l'étudiant auteur ou le formateur du cours uniquement."""
    submission = get_object_or_404(Submission.objects.select_related('lesson__module__course'), pk=pk)
    if submission.user_id != request.user.id and not _is_staff_of(request.user, submission.course):
        raise PermissionDenied()
    if not submission.file:
        return Response({'error': 'Aucun fichier'}, status=status.HTTP_404_NOT_FOUND)
    name = os.path.basename(submission.file.name)
    return FileResponse(submission.file.open('rb'), as_attachment=True, filename=name,
                        content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')

