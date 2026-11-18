from datetime import timedelta

from django.utils import timezone

from analytics.models import DailyActivity, ReviewCard
from courses.models import Certificate, Enrollment, Lesson
from users.models import UserProfile

from .conftest import make_user

QUIZ = [
    {'question': 'Capitale du Sénégal ?', 'options': ['Dakar', 'Thiès', 'Saint-Louis'], 'answer': 0, 'explanation': 'Dakar.'},
    {'question': '2 + 2 ?', 'options': ['3', '4'], 'answer': 1},
]


def _quiz_lesson(course):
    lesson = Lesson.objects.filter(module__course=course).first()
    lesson.type, lesson.quiz = 'QUIZ', QUIZ
    lesson.save()
    return lesson


def test_wrong_quiz_answers_become_review_cards(auth, student, free_course):
    lesson = _quiz_lesson(free_course)
    Enrollment.objects.create(user=student, course=free_course)
    client = auth(student)
    resp = client.post(f'/api/v1/courses/lessons/{lesson.id}/quiz/', {'answers': [2, 1]}, format='json')
    assert resp.status_code in (200, 201)
    cards = ReviewCard.objects.filter(user=student)
    assert [c.question_index for c in cards] == [0]  # seule la question ratée
    card = cards[0]
    assert card.due == timezone.localdate() + timedelta(days=1)

    # Rien à réviser aujourd'hui ; demain, la carte est due — sans la bonne réponse dans la réponse API
    assert client.get('/api/v1/analytics/reviews/').data['due_count'] == 0
    ReviewCard.objects.filter(pk=card.pk).update(due=timezone.localdate())
    data = client.get('/api/v1/analytics/reviews/').data
    assert data['due_count'] == 1 and 'answer' not in data['cards'][0]

    # Bonne réponse : boîte 2, revue dans 3 jours
    resp = client.post(f'/api/v1/analytics/reviews/{card.pk}/answer/', {'choice': 0}, format='json')
    assert resp.data['correct'] is True and resp.data['box'] == 2
    assert resp.data['next_due'] == timezone.localdate() + timedelta(days=3)

    # Mauvaise réponse : retour en boîte 1
    resp = client.post(f'/api/v1/analytics/reviews/{card.pk}/answer/', {'choice': 1}, format='json')
    assert resp.data['correct'] is False and resp.data['box'] == 1

    # Après la boîte 5, la question est maîtrisée
    ReviewCard.objects.filter(pk=card.pk).update(box=5)
    resp = client.post(f'/api/v1/analytics/reviews/{card.pk}/answer/', {'choice': 0}, format='json')
    assert resp.data['mastered'] is True


def test_review_cards_are_private(auth, student, free_course):
    lesson = _quiz_lesson(free_course)
    card = ReviewCard.objects.create(user=student, lesson=lesson, question_index=0, due=timezone.localdate())
    intruder = make_user('intrus@test.com')
    resp = auth(intruder).post(f'/api/v1/analytics/reviews/{card.pk}/answer/', {'choice': 0}, format='json')
    assert resp.status_code == 404


def test_weekly_leaderboard(auth, student):
    other = make_user('awa@test.com')
    hidden = make_user('discret@test.com')
    today = timezone.localdate()
    DailyActivity.objects.create(user=student, date=today, minutes=20)
    DailyActivity.objects.create(user=other, date=today, minutes=45)
    DailyActivity.objects.create(user=hidden, date=today, minutes=90)
    DailyActivity.objects.create(user=student, date=today - timedelta(days=8), minutes=500)  # semaine passée
    UserProfile.objects.update_or_create(user=hidden, defaults={'show_in_leaderboard': False})
    data = auth(student).get('/api/v1/analytics/leaderboard/').data
    assert [r['minutes'] for r in data['top']] == [45, 20]
    assert data['top'][0]['name'] == 'Awa T.'  # prénom + initiale, jamais l'email
    assert data['me'] == {'rank': 2, 'minutes': 20, 'participants': 2}


def test_public_profile_is_opt_in(api, auth, student, free_course):
    enrollment = Enrollment.objects.create(user=student, course=free_course, status='COMPLETED')
    Certificate.issue_for(enrollment)
    client = auth(student)
    settings_resp = client.get('/api/v1/analytics/public-profile/').data
    assert settings_resp['public_profile'] is False

    resp = client.patch('/api/v1/analytics/public-profile/', {'public_profile': True, 'headline': 'Développeuse web'}, format='json')
    handle = resp.data['public_handle']
    assert handle

    api.force_authenticate(None)
    data = api.get(f'/api/v1/analytics/profiles/{handle}/').data
    assert data['headline'] == 'Développeuse web'
    assert data['certificates'][0]['course'] == free_course.title
    assert 'email' not in data

    other = make_user('autre@test.com')
    resp = auth(other).patch('/api/v1/analytics/public-profile/', {'public_profile': True, 'public_handle': handle}, format='json')
    assert resp.status_code == 400  # adresse déjà prise

    auth(student).patch('/api/v1/analytics/public-profile/', {'public_profile': False}, format='json')
    api.force_authenticate(None)
    assert api.get(f'/api/v1/analytics/profiles/{handle}/').status_code == 404
