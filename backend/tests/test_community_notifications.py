from courses.models import Lesson
from notifications.models import Notification

from .conftest import make_user


def _first_lesson(course):
    return Lesson.objects.filter(module__course=course).order_by('module__order', 'order').first()


def test_enrollment_and_payment_notify(auth, student, instructor, free_course, paid_course):
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert Notification.objects.filter(user=student, kind='ENROLLMENT').exists()
    assert Notification.objects.filter(user=instructor, kind='ENROLLMENT').exists()

    pid = client.post('/api/v1/payments/checkout/', {'gateway': 'WAVE', 'course_slug': paid_course.slug},
                      format='json').data['payment']['id']
    client.post(f'/api/v1/payments/{pid}/sandbox-confirm/', format='json')
    assert Notification.objects.filter(user=student, kind='PAYMENT').count() == 1


def test_notification_api(auth, student, free_course):
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert client.get('/api/v1/notifications/unread-count/').data['unread'] == 1
    items = client.get('/api/v1/notifications/').data['results']
    assert items[0]['link'] == f'/learn/{free_course.slug}'
    client.post('/api/v1/notifications/mark-read/', {}, format='json')
    assert client.get('/api/v1/notifications/unread-count/').data['unread'] == 0


def test_notifications_are_private(auth, student, instructor, free_course):
    auth(student).post(f'/api/v1/courses/{free_course.slug}/enroll/')
    other = make_user('autre@test.com')
    assert auth(other).get('/api/v1/notifications/').data['count'] == 0
    # Impossible de marquer comme lues les notifications d'un autre
    ids = [str(n.id) for n in Notification.objects.filter(user=student)]
    auth(other).post('/api/v1/notifications/mark-read/', {'ids': ids}, format='json')
    assert Notification.objects.filter(user=student, is_read=False).count() == len(ids)


def test_lesson_discussion_flow(auth, student, instructor, free_course):
    lesson = _first_lesson(free_course)
    url = f'/api/v1/community/lessons/{lesson.id}/threads/'

    # Non inscrit : pas d'accès
    assert auth(student).get(url).status_code == 403

    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    resp = client.post(url, {'body': 'Comment fonctionne ce concept ?'}, format='json')
    assert resp.status_code == 201
    thread_id = resp.data['id']
    assert Notification.objects.filter(user=instructor, kind='COMMUNITY').exists()

    # Le formateur voit la question dans sa boîte et répond
    teacher = auth(instructor)
    inbox = teacher.get('/api/v1/community/instructor/inbox/').data
    assert [t['id'] for t in inbox] == [thread_id]
    resp = teacher.post(f'/api/v1/community/threads/{thread_id}/replies/', {'body': 'Voici l\'explication.'},
                        format='json')
    assert resp.status_code == 201 and resp.data['author']['is_instructor'] is True
    assert teacher.get('/api/v1/community/instructor/inbox/').data == []
    assert Notification.objects.filter(user=student, kind='COMMUNITY').exists()

    # L'étudiant voit la réponse, aime et marque résolu
    client = auth(student)
    threads = client.get(url).data
    assert len(threads) == 1 and len(threads[0]['replies']) == 1
    reply_id = threads[0]['replies'][0]['id']
    assert client.post(f'/api/v1/community/comments/{reply_id}/like/').data == {'liked': True, 'likes_count': 1}
    assert client.post(f'/api/v1/community/threads/{thread_id}/resolve/').data['is_resolved'] is True


def test_discussion_moderation_and_permissions(auth, student, instructor, free_course):
    lesson = _first_lesson(free_course)
    url = f'/api/v1/community/lessons/{lesson.id}/threads/'
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert client.post(url, {'body': 'formateur idiot'}, format='json').data == {'pending_moderation': True}
    assert client.get(url).data == []

    thread_id = client.post(url, {'body': 'Question légitime ?'}, format='json').data['id']
    intruder = make_user('intrus@test.com')
    intruder_client = auth(intruder)
    intruder_client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    # Un autre étudiant ne peut ni supprimer ni résoudre la question
    assert intruder_client.delete(f'/api/v1/community/comments/{thread_id}/').status_code == 403
    assert intruder_client.post(f'/api/v1/community/threads/{thread_id}/resolve/').status_code == 403
    # Le formateur peut supprimer
    assert auth(instructor).delete(f'/api/v1/community/comments/{thread_id}/').status_code == 204
