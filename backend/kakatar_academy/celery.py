import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kakatar_academy.settings')

app = Celery('kakatar_academy')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
