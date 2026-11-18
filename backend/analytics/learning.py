"""Révisions intelligentes, ligue hebdomadaire et profil public (portfolio)."""
import secrets
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import DailyActivity, ReviewCard

MAX_SESSION = 20


# ---------------------------------------------------------------------------
# Révisions (répétition espacée)
# ---------------------------------------------------------------------------
def schedule_from_quiz(user, lesson, answers):
    """Après un quiz : chaque question ratée entre (ou revient) dans la boîte 1, à revoir dès demain."""
    tomorrow = timezone.localdate() + timedelta(days=1)
    for i, question in enumerate(lesson.quiz or []):
        if i < len(answers) and answers[i] == question.get('answer'):
            continue
        card, created = ReviewCard.objects.get_or_create(
            user=user, lesson=lesson, question_index=i, defaults={'due': tomorrow})
        if not created:
            card.box, card.due, card.mastered = 1, tomorrow, False
            card.lapses += 1
            card.save(update_fields=['box', 'due', 'mastered', 'lapses', 'updated_at'])


def _accessible(user, lesson):
    return lesson.is_free or user.enrollments.filter(
        course_id=lesson.module.course_id, status__in=['ACTIVE', 'COMPLETED']).exists()


def _card_data(card):
    q = card.lesson.quiz[card.question_index]
    course = card.lesson.module.course
    return {'id': card.id, 'question': q.get('question', ''), 'options': q.get('options', []), 'box': card.box,
            'lesson': {'id': str(card.lesson_id), 'title': card.lesson.title},
            'course': {'slug': course.slug, 'title': course.title}}


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def reviews(request):
    """Cartes à réviser aujourd'hui (20 au plus) et statistiques."""
    today = timezone.localdate()
    base = ReviewCard.objects.filter(user=request.user)
    due_qs = base.filter(mastered=False, due__lte=today).select_related('lesson__module__course').order_by('due', 'box')
    cards = []
    for card in due_qs[:MAX_SESSION * 2]:
        # La question peut avoir été supprimée ou le cours quitté entre-temps
        if card.question_index >= len(card.lesson.quiz or []) or not _accessible(request.user, card.lesson):
            continue
        cards.append(_card_data(card))
        if len(cards) == MAX_SESSION:
            break
    next_due = base.filter(mastered=False, due__gt=today).order_by('due').values_list('due', flat=True).first()
    return Response({
        'due_count': due_qs.count(), 'total': base.count(), 'mastered': base.filter(mastered=True).count(),
        'next_due': next_due, 'cards': cards,
        'boxes': [base.filter(mastered=False, box=b).count() for b in range(1, 6)],
    })


class ReviewAnswerSerializer(serializers.Serializer):
    choice = serializers.IntegerField(min_value=0)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def review_answer(request, pk):
    """Bonne réponse : boîte suivante (intervalle plus long). Mauvaise : retour en boîte 1."""
    ser = ReviewAnswerSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        card = get_object_or_404(ReviewCard.objects.select_for_update().select_related('lesson__module'),
                                 pk=pk, user=request.user)
        quiz = card.lesson.quiz or []
        if card.question_index >= len(quiz):
            card.delete()
            return Response({'error': "Cette question n'existe plus."}, status=status.HTTP_410_GONE)
        question = quiz[card.question_index]
        correct = ser.validated_data['choice'] == question.get('answer')
        today = timezone.localdate()
        if correct:
            if card.box >= 5:
                card.mastered = True
            else:
                card.box += 1
            card.due = today + timedelta(days=ReviewCard.INTERVALS[card.box])
        else:
            card.box, card.due = 1, today + timedelta(days=1)
            card.lapses += 1
        card.reviews += 1
        card.save()
    return Response({'correct': correct, 'answer': question.get('answer'), 'explanation': question.get('explanation', ''),
                     'box': card.box, 'mastered': card.mastered, 'next_due': card.due})


# ---------------------------------------------------------------------------
# Ligue hebdomadaire
# ---------------------------------------------------------------------------
def _display_name(user):
    last = (user.last_name or '')[:1]
    return f'{user.first_name} {last}.'.strip() if last else (user.first_name or 'Apprenant')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def leaderboard(request):
    """Classement de la semaine (lundi → dimanche) par minutes d'apprentissage."""
    today = timezone.localdate()
    start = today - timedelta(days=today.weekday())
    rows = (DailyActivity.objects.filter(date__gte=start, date__lte=today, minutes__gt=0,
                                         user__is_active=True, user__profile__show_in_leaderboard=True)
            .values('user').annotate(total=Sum('minutes')).order_by('-total', 'user'))
    ranking = list(rows[:200])
    from users.models import User
    users = {u.id: u for u in User.objects.filter(id__in=[r['user'] for r in ranking[:20]]).select_related('profile')}
    top = []
    for rank, row in enumerate(ranking[:20], start=1):
        u = users[row['user']]
        profile = getattr(u, 'profile', None)
        top.append({'rank': rank, 'name': _display_name(u), 'minutes': row['total'], 'is_me': u.id == request.user.id,
                    'handle': profile.public_handle if profile and profile.public_profile else None})
    me = next((i for i, r in enumerate(ranking, start=1) if r['user'] == request.user.id), None)
    my_minutes = next((r['total'] for r in ranking if r['user'] == request.user.id), 0)
    return Response({'week_start': start, 'week_end': start + timedelta(days=6), 'top': top,
                     'me': {'rank': me, 'minutes': my_minutes, 'participants': len(ranking)}})


# ---------------------------------------------------------------------------
# Profil public (portfolio)
# ---------------------------------------------------------------------------
def _unique_handle(user):
    from users.models import UserProfile
    base = slugify(user.get_full_name())[:30] or 'apprenant'
    handle = base
    while UserProfile.objects.filter(public_handle=handle).exclude(user=user).exists():
        handle = f'{base}-{secrets.token_hex(2)}'
    return handle


class PublicProfileSettingsSerializer(serializers.Serializer):
    public_profile = serializers.BooleanField(required=False)
    public_handle = serializers.SlugField(max_length=40, min_length=3, required=False)
    headline = serializers.CharField(max_length=120, required=False, allow_blank=True)
    show_in_leaderboard = serializers.BooleanField(required=False)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_settings(request):
    from users.models import UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if request.method == 'PATCH':
        ser = PublicProfileSettingsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        handle = data.get('public_handle')
        if handle and UserProfile.objects.filter(public_handle=handle).exclude(pk=profile.pk).exists():
            return Response({'error': 'Cette adresse est déjà prise.'}, status=status.HTTP_400_BAD_REQUEST)
        for field, value in data.items():
            setattr(profile, field, value)
        if profile.public_profile and not profile.public_handle:
            profile.public_handle = _unique_handle(request.user)
        profile.save()
    return Response({'public_profile': profile.public_profile, 'public_handle': profile.public_handle,
                     'headline': profile.headline, 'show_in_leaderboard': profile.show_in_leaderboard})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile(request, handle):
    """Portfolio public : certificats vérifiables, badges, compétences. N'expose ni email ni activité détaillée."""
    from courses.models import Certificate
    from users.models import UserProfile

    from .achievements import compute

    profile = get_object_or_404(UserProfile.objects.select_related('user'), public_handle=handle,
                                public_profile=True, user__is_active=True)
    user = profile.user
    certificates = Certificate.objects.filter(enrollment__user=user).select_related(
        'enrollment__course__category', 'enrollment__course__instructor')
    achievements = compute(user)
    skills = list(profile.skills or [])
    for cert in certificates:
        category = cert.enrollment.course.category
        if category and category.name not in skills:
            skills.append(category.name)
    return Response({
        'name': user.get_full_name(), 'headline': profile.headline, 'bio': user.bio,
        'avatar': user.avatar.url if user.avatar else None, 'member_since': user.date_joined,
        'level': achievements['level'], 'level_name': achievements['level_name'], 'xp': achievements['xp'],
        'badges': [b for b in achievements['badges'] if b['unlocked']],
        'skills': skills[:20],
        'certificates': [{'code': c.code, 'course': c.enrollment.course.title, 'course_slug': c.enrollment.course.slug,
                          'instructor': c.enrollment.course.instructor.get_full_name(), 'issued_at': c.issued_at}
                         for c in certificates],
        'longest_streak': profile.longest_streak,
    })
