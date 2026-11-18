from django.db.models import Count, Exists, OuterRef, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ai_services.services import moderate_text
from courses.models import Lesson
from notifications.services import notify
from users.permissions import IsFormateurUser

from .models import LessonComment


def _is_staff_of(user, course):
    return user.role == 'ADMIN' or course.instructor_id == user.id


def _check_access(user, lesson):
    course = lesson.module.course
    if _is_staff_of(user, course):
        return
    if not user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).exists():
        raise PermissionDenied('Les discussions sont réservées aux inscrits du cours.')


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True, default=0)
    liked = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = LessonComment
        fields = ['id', 'body', 'author', 'is_resolved', 'likes_count', 'liked', 'can_delete', 'replies',
                  'created_at']

    def get_author(self, obj):
        course = self.context['course']
        return {'id': str(obj.user_id), 'name': obj.user.get_full_name(), 'avatar': obj.user.get_avatar_url(),
                'is_instructor': obj.user_id == course.instructor_id}

    def get_liked(self, obj):
        return self.context['request'].user.id in {u.id for u in obj.likes.all()}

    def get_can_delete(self, obj):
        user = self.context['request'].user
        return obj.user_id == user.id or _is_staff_of(user, self.context['course'])

    def get_replies(self, obj):
        if obj.parent_id:
            return []
        replies = [r for r in obj.replies.all() if not r.is_hidden]
        return CommentSerializer(sorted(replies, key=lambda r: r.created_at), many=True, context=self.context).data

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data['likes_count'] = obj.likes.count()
        return data


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def lesson_threads(request, lesson_id):
    """GET : questions de la leçon avec leurs réponses. POST {"body"} : poser une question."""
    lesson = get_object_or_404(Lesson.objects.select_related('module__course__instructor'), id=lesson_id)
    _check_access(request.user, lesson)
    course = lesson.module.course
    context = {'request': request, 'course': course}

    if request.method == 'POST':
        body = (request.data.get('body') or '').strip()
        if len(body) < 3:
            return Response({'error': 'Message trop court.'}, status=status.HTTP_400_BAD_REQUEST)
        comment = LessonComment.objects.create(lesson=lesson, user=request.user, body=body[:5000],
                                               is_hidden=moderate_text(body)['flagged'])
        if comment.is_hidden:
            return Response({'pending_moderation': True}, status=status.HTTP_201_CREATED)
        if course.instructor_id != request.user.id:
            notify(course.instructor, 'COMMUNITY', f'Nouvelle question sur « {lesson.title} »', body[:200],
                   f'/learn/{course.slug}?lesson={lesson.id}&tab=discussion')
        return Response(CommentSerializer(comment, context=context).data, status=status.HTTP_201_CREATED)

    threads = (LessonComment.objects.filter(lesson=lesson, parent__isnull=True, is_hidden=False)
               .select_related('user')
               .prefetch_related('likes', Prefetch('replies', LessonComment.objects.select_related('user')
                                                    .prefetch_related('likes'))))
    if request.query_params.get('unresolved') == 'true':
        threads = threads.filter(is_resolved=False)
    return Response(CommentSerializer(threads[:100], many=True, context=context).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reply(request, pk):
    thread = get_object_or_404(LessonComment.objects.select_related('lesson__module__course', 'user'),
                               pk=pk, parent__isnull=True)
    lesson = thread.lesson
    _check_access(request.user, lesson)
    body = (request.data.get('body') or '').strip()
    if len(body) < 2:
        return Response({'error': 'Message trop court.'}, status=status.HTTP_400_BAD_REQUEST)
    answer = LessonComment.objects.create(lesson=lesson, user=request.user, parent=thread, body=body[:5000],
                                          is_hidden=moderate_text(body)['flagged'])
    if answer.is_hidden:
        return Response({'pending_moderation': True}, status=status.HTTP_201_CREATED)
    course = lesson.module.course
    if thread.user_id != request.user.id:
        who = 'Le formateur' if request.user.id == course.instructor_id else request.user.get_full_name()
        notify(thread.user, 'COMMUNITY', f'{who} a répondu à votre question', body[:200],
               f'/learn/{course.slug}?lesson={lesson.id}&tab=discussion')
    return Response(CommentSerializer(answer, context={'request': request, 'course': course}).data,
                    status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_resolved(request, pk):
    thread = get_object_or_404(LessonComment.objects.select_related('lesson__module__course'), pk=pk,
                               parent__isnull=True)
    if thread.user_id != request.user.id and not _is_staff_of(request.user, thread.course):
        raise PermissionDenied()
    thread.is_resolved = not thread.is_resolved
    thread.save(update_fields=['is_resolved'])
    return Response({'is_resolved': thread.is_resolved})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_like(request, pk):
    comment = get_object_or_404(LessonComment.objects.select_related('lesson__module__course'), pk=pk)
    _check_access(request.user, comment.lesson)
    if comment.likes.filter(id=request.user.id).exists():
        comment.likes.remove(request.user)
        liked = False
    else:
        comment.likes.add(request.user)
        liked = True
    return Response({'liked': liked, 'likes_count': comment.likes.count()})


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_comment(request, pk):
    comment = get_object_or_404(LessonComment.objects.select_related('lesson__module__course'), pk=pk)
    if comment.user_id != request.user.id and not _is_staff_of(request.user, comment.course):
        raise PermissionDenied()
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_inbox(request):
    """Questions sur les cours du formateur sans réponse de sa part (les plus anciennes d'abord)."""
    instructor_replied = LessonComment.objects.filter(parent=OuterRef('pk'), user=request.user)
    threads = (LessonComment.objects
               .filter(lesson__module__course__instructor=request.user, parent__isnull=True, is_hidden=False,
                       is_resolved=False)
               .exclude(user=request.user)
               .annotate(answered=Exists(instructor_replied), replies_count=Count('replies'))
               .filter(answered=False)
               .select_related('user', 'lesson__module__course')
               .order_by('created_at')[:50])
    return Response([{
        'id': str(t.id), 'body': t.body, 'student': t.user.get_full_name(), 'created_at': t.created_at,
        'lesson_id': str(t.lesson_id), 'lesson_title': t.lesson.title,
        'course_title': t.lesson.module.course.title, 'course_slug': t.lesson.module.course.slug,
        'replies_count': t.replies_count,
    } for t in threads])


# ---------------------------------------------------------------------------
# Annonces du formateur
# ---------------------------------------------------------------------------
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def course_announcements(request, slug):
    """GET : annonces du cours (inscrits et formateur). POST {title, body} : publier (formateur du cours)."""
    from courses.models import Course, Enrollment
    from .models import Announcement

    course = get_object_or_404(Course, slug=slug)
    staff = _is_staff_of(request.user, course)
    if not staff and not request.user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).exists():
        raise PermissionDenied('Réservé aux inscrits du cours.')

    if request.method == 'GET':
        return Response([{
            'id': str(a.id), 'title': a.title, 'body': a.body, 'created_at': a.created_at,
            'author': a.author.get_full_name(), 'recipients_count': a.recipients_count if staff else None,
        } for a in course.announcements.select_related('author')[:50]])

    if not staff:
        raise PermissionDenied('Seul le formateur peut publier une annonce.')
    title = (request.data.get('title') or '').strip()
    body = (request.data.get('body') or '').strip()
    if len(title) < 3 or len(body) < 10:
        return Response({'error': 'Titre (3 caractères) et message (10 caractères) requis.'},
                        status=status.HTTP_400_BAD_REQUEST)
    students = [e.user for e in Enrollment.objects.filter(course=course, status__in=['ACTIVE', 'COMPLETED'])
                .select_related('user')]
    announcement = Announcement.objects.create(course=course, author=request.user, title=title[:200], body=body[:5000],
                                               recipients_count=len(students))
    link = f'/learn/{course.slug}?tab=announcements'
    for student in students:
        notify(student, 'COURSE', f'📣 {course.title} : {title}', body[:200], link)
    from django.db import transaction
    from .tasks import send_announcement_emails
    transaction.on_commit(lambda: send_announcement_emails.delay(str(announcement.id)))
    return Response({'id': str(announcement.id), 'recipients_count': len(students)}, status=status.HTTP_201_CREATED)
