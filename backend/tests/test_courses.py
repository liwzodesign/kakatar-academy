from courses.models import Course, Enrollment, Lesson

from .conftest import make_user


def test_catalog_is_public(api, paid_course, free_course):
    resp = api.get('/api/v1/courses/')
    assert resp.status_code == 200
    assert resp.data['count'] == 2
    resp = api.get('/api/v1/courses/', {'search': 'gratuit'})
    assert [c['slug'] for c in resp.data['results']] == [free_course.slug]


def test_locked_content_until_enrolled(api, auth, student, paid_course):
    detail = api.get(f'/api/v1/courses/{paid_course.slug}/').data
    free_lesson = detail['modules'][0]['lessons'][0]
    locked_lesson = detail['modules'][1]['lessons'][0]
    assert free_lesson['locked'] is False and free_lesson['content']
    assert locked_lesson['locked'] is True and locked_lesson['content'] == ''
    # Inscription directe refusée pour un cours payant
    resp = auth(student).post(f'/api/v1/courses/{paid_course.slug}/enroll/')
    assert resp.status_code == 402


def test_free_enrollment_progress_and_certificate(auth, student, free_course):
    client = auth(student)
    resp = client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert resp.status_code == 201
    lessons = Lesson.objects.filter(module__course=free_course).order_by('module__order', 'order')
    for lesson in lessons:
        resp = client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/')
        assert resp.status_code == 200
    assert resp.data['progress'] == 100 and resp.data['status'] == 'COMPLETED'
    code = resp.data['certificate_code']
    assert code
    client.force_authenticate(None)
    resp = client.get(f'/api/v1/courses/certificates/verify/{code}/')
    assert resp.status_code == 200 and resp.data['course_title'] == free_course.title
    free_course.refresh_from_db()
    assert free_course.students_count == 1 and float(free_course.completion_rate) == 100


def test_quiz_must_be_passed(auth, student, free_course):
    lesson = Lesson.objects.filter(module__course=free_course).first()
    lesson.type = 'QUIZ'
    lesson.quiz = [{'question': '2+2 ?', 'options': ['3', '4'], 'answer': 1}]
    lesson.save()
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/').status_code == 400
    resp = client.post(f'/api/v1/courses/lessons/{lesson.id}/quiz/', {'answers': [0]}, format='json')
    assert resp.data['passed'] is False
    resp = client.post(f'/api/v1/courses/lessons/{lesson.id}/quiz/', {'answers': [1]}, format='json')
    assert resp.data['passed'] is True
    assert client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/').status_code == 200


def test_instructor_builds_course(auth, instructor, category):
    client = auth(instructor)
    resp = client.post('/api/v1/courses/create/', {
        'title': 'Mon nouveau cours', 'description': 'Desc', 'category': category.id, 'level': 'DEBUTANT',
        'type': 'PAID', 'price': 10000}, format='json')
    assert resp.status_code == 201, resp.data
    slug = resp.data['slug']
    module = client.post(f'/api/v1/courses/{slug}/modules/create/', {'title': 'Intro'}, format='json').data
    lesson = client.post(f"/api/v1/courses/modules/{module['id']}/lessons/create/",
                         {'title': 'Bienvenue', 'type': 'TEXT', 'content': 'Salut', 'estimated_duration': 5},
                         format='json')
    assert lesson.status_code == 201, lesson.data
    resp = client.patch(f'/api/v1/courses/{slug}/update/', {'status': 'PUBLISHED'}, format='json')
    assert resp.status_code == 200
    course = Course.objects.get(slug=slug)
    assert course.published_at and course.lessons_count == 1
    assert client.get('/api/v1/courses/mine/').data[0]['slug'] == slug


def test_unverified_instructor_cannot_publish(auth, category, db):
    trainer = make_user('pasverifie@test.com', role='FORMATEUR')
    resp = auth(trainer).post('/api/v1/courses/create/', {
        'title': 'X', 'description': 'D', 'category': category.id, 'price': 0, 'type': 'FREE',
        'status': 'PUBLISHED'}, format='json')
    assert resp.status_code == 400


def test_other_instructor_cannot_edit(auth, paid_course, db):
    other = make_user('autre@test.com', role='FORMATEUR', verification_status='VERIFIED')
    resp = auth(other).patch(f'/api/v1/courses/{paid_course.slug}/update/', {'title': 'Piraté'}, format='json')
    assert resp.status_code == 403


def test_review_requires_enrollment_and_updates_rating(auth, student, free_course):
    client = auth(student)
    url = f'/api/v1/courses/{free_course.slug}/reviews/create/'
    assert client.post(url, {'rating': 5}, format='json').status_code == 400
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    resp = client.post(url, {'rating': 4, 'comment': 'Très bien expliqué'}, format='json')
    assert resp.status_code == 201
    free_course.refresh_from_db()
    assert float(free_course.rating_average) == 4 and free_course.rating_count == 1


def test_review_moderation_hides_insults(auth, student, free_course):
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    resp = client.post(f'/api/v1/courses/{free_course.slug}/reviews/create/',
                       {'rating': 1, 'comment': 'formateur idiot, arnaque'}, format='json')
    assert resp.data['pending_moderation'] is True
    assert client.get(f'/api/v1/courses/{free_course.slug}/reviews/').data['count'] == 0


def test_favorites(auth, student, free_course):
    client = auth(student)
    assert client.post(f'/api/v1/courses/{free_course.slug}/favorite/').data['is_favorite'] is True
    assert len(client.get('/api/v1/courses/favorites/').data) == 1
    assert client.post(f'/api/v1/courses/{free_course.slug}/favorite/').data['is_favorite'] is False


def test_course_analytics_owner_only(auth, instructor, student, free_course):
    auth(student).post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert auth(student).get(f'/api/v1/courses/{free_course.slug}/analytics/').status_code == 403
    resp = auth(instructor).get(f'/api/v1/courses/{free_course.slug}/analytics/')
    assert resp.status_code == 200 and resp.data['total_enrollments'] == 1


def test_graphql_catalog(api, free_course):
    resp = api.post('/graphql/', {'query': '{ courses { title slug } }'}, format='json')
    assert resp.status_code == 200
    assert resp.json()['data']['courses'][0]['slug'] == free_course.slug


def test_health(api, db):
    assert api.get('/health/').json()['status'] == 'ok'


def test_enrollment_unique(student, free_course):
    from courses.views import enroll_user
    enroll_user(student, free_course)
    enroll_user(student, free_course)
    assert Enrollment.objects.filter(user=student, course=free_course).count() == 1
