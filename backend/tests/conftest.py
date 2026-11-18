from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from courses.models import Category, Course, Lesson, Module
from users.models import User

PASSWORD = 'Sup3r-Secret!'


@pytest.fixture(autouse=True)
def _settings(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / 'media'
    settings.PAYMENTS_ALLOW_SANDBOX = True
    settings.STRIPE_SECRET_KEY = ''
    settings.PAYDUNYA_MASTER_KEY = ''
    settings.WAVE_API_KEY = ''
    settings.OPENAI_API_KEY = ''
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # tests rapides
    settings.STORAGES = {**settings.STORAGES, 'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}
    cache.clear()  # remet à zéro les compteurs de throttling


@pytest.fixture
def api():
    return APIClient()


def make_user(email, role='ETUDIANT', **extra):
    return User.objects.create_user(email=email, password=PASSWORD, first_name=email.split('@')[0].title(),
                                    last_name='Test', role=role, **extra)


@pytest.fixture
def student(db):
    return make_user('etudiant@test.com')


@pytest.fixture
def instructor(db):
    return make_user('formateur@test.com', role='FORMATEUR', verification_status='VERIFIED', is_verified=True)


@pytest.fixture
def admin_user(db):
    return make_user('admin@test.com', role='ADMIN', is_staff=True, verification_status='VERIFIED', is_verified=True)


@pytest.fixture
def auth(api):
    def _auth(user):
        api.force_authenticate(user)
        return api
    return _auth


@pytest.fixture
def category(db):
    return Category.objects.create(name='Développement Web')


def build_course(instructor, category, price=50000, title='Cours de test', lessons_per_module=2):
    course = Course.objects.create(title=title, description='Description', category=category,
                                   instructor=instructor, price=price, type='PAID' if price else 'FREE',
                                   status='PUBLISHED')
    for m in range(2):
        module = Module.objects.create(course=course, title=f'Module {m + 1}', is_free=(m == 0))
        for i in range(lessons_per_module):
            Lesson.objects.create(module=module, title=f'Leçon {m + 1}.{i + 1}', type='TEXT',
                                  content='Contenu secret de la leçon', estimated_duration=10)
    course.update_stats()
    return course


@pytest.fixture
def paid_course(instructor, category):
    return build_course(instructor, category, price=50000, title='Cours payant')


@pytest.fixture
def free_course(instructor, category):
    return build_course(instructor, category, price=0, title='Cours gratuit')


@pytest.fixture
def future():
    return timezone.now() + timedelta(days=3)
