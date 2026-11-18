from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile

from assignments.models import Submission
from courses.models import Enrollment, Lesson
from notifications.models import Notification

from .conftest import make_user


def _graded_lesson(course):
    lesson = Lesson.objects.filter(module__course=course).order_by('module__order', 'order').first()
    lesson.type = 'ASSIGNMENT'
    lesson.save()
    return lesson


def test_assignment_full_cycle(auth, student, instructor, free_course):
    lesson = _graded_lesson(free_course)
    client = auth(student)
    url = f'/api/v1/assignments/lessons/{lesson.id}/submission/'
    assert client.get(url).status_code == 403  # pas inscrit
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert client.get(url).data is None

    # Impossible de valider la leçon sans rendu approuvé
    assert client.post(f'/api/v1/courses/lessons/{lesson.id}/complete/').status_code == 400
    assert client.post(url, {}, format='multipart').status_code == 400  # rendu vide

    resp = client.post(url, {'text': 'Ma réponse', 'file': SimpleUploadedFile('rendu.pdf', b'%PDF', content_type='application/pdf')},
                       format='multipart')
    assert resp.status_code == 201 and resp.data['status'] == 'SUBMITTED' and resp.data['has_file']
    sub_id = resp.data['id']
    assert Notification.objects.filter(user=instructor, link='/assignments').exists()

    teacher = auth(instructor)
    queue = teacher.get('/api/v1/assignments/instructor/').data
    assert [s['id'] for s in queue] == [sub_id]
    assert teacher.get(f'/api/v1/assignments/submissions/{sub_id}/file/').status_code == 200

    # Reprise demandée : un commentaire est obligatoire
    review = f'/api/v1/assignments/submissions/{sub_id}/review/'
    assert teacher.post(review, {'status': 'NEEDS_REVISION'}, format='json').status_code == 400
    assert teacher.post(review, {'status': 'NEEDS_REVISION', 'feedback': 'Ajoute un exemple'}, format='json').data['status'] == 'NEEDS_REVISION'

    # Nouvelle version puis validation : la leçon est validée pour l'étudiant
    resp = auth(student).post(url, {'text': 'Ma réponse avec exemple'}, format='multipart')
    assert resp.data['attempts'] == 2 and resp.data['status'] == 'SUBMITTED'
    resp = auth(instructor).post(review, {'status': 'APPROVED', 'grade': 85, 'feedback': 'Très bien'}, format='json')
    assert resp.data['grade'] == 85
    enrollment = Enrollment.objects.get(user=student, course=free_course)
    assert enrollment.completed_lessons.filter(id=lesson.id).exists()
    assert float(enrollment.progress) > 0
    # Un travail validé ne peut plus être modifié
    assert auth(student).post(url, {'text': 'modif'}, format='multipart').status_code == 400


def test_assignment_privacy(auth, student, instructor, free_course):
    lesson = _graded_lesson(free_course)
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    sub_id = client.post(f'/api/v1/assignments/lessons/{lesson.id}/submission/',
                         {'file': SimpleUploadedFile('a.txt', b'secret', content_type='text/plain')}, format='multipart').data['id']
    other_student = make_user('curieux@test.com')
    other_teacher = make_user('autreprof@test.com', role='FORMATEUR', verification_status='VERIFIED')
    assert auth(other_student).get(f'/api/v1/assignments/submissions/{sub_id}/file/').status_code == 403
    assert auth(other_teacher).post(f'/api/v1/assignments/submissions/{sub_id}/review/', {'status': 'APPROVED'},
                                    format='json').status_code == 403
    assert auth(other_teacher).get('/api/v1/assignments/instructor/').data == []


def test_non_graded_lesson_rejects_submission(auth, student, free_course):
    lesson = Lesson.objects.filter(module__course=free_course).first()
    client = auth(student)
    client.post(f'/api/v1/courses/{free_course.slug}/enroll/')
    assert client.post(f'/api/v1/assignments/lessons/{lesson.id}/submission/', {'text': 'x'}, format='multipart').status_code == 400


def test_announcement_notifies_and_respects_email_preferences(auth, student, instructor, free_course):
    quiet = make_user('silence@test.com', email_notifications=False)
    for user in (student, quiet):
        auth(user).post(f'/api/v1/courses/{free_course.slug}/enroll/')
    mail.outbox.clear()
    url = f'/api/v1/community/courses/{free_course.slug}/announcements/'
    assert auth(student).post(url, {'title': 'Hack', 'body': 'Je ne suis pas formateur'}, format='json').status_code == 403
    resp = auth(instructor).post(url, {'title': 'Session de révision', 'body': 'Rendez-vous jeudi à 18 h en ligne.'},
                                 format='json')
    assert resp.status_code == 201 and resp.data['recipients_count'] == 2
    # Notification in-app pour tous, email seulement pour qui l'accepte
    assert Notification.objects.filter(title__contains='Session de révision').count() == 2
    from community.tasks import send_announcement_emails
    from community.models import Announcement
    assert send_announcement_emails(str(Announcement.objects.get().id)) == 1
    assert [m.to for m in mail.outbox] == [[student.email]]
    listing = auth(student).get(url).data
    assert listing[0]['title'] == 'Session de révision' and listing[0]['recipients_count'] is None
    assert auth(make_user('externe@test.com')).get(url).status_code == 403
