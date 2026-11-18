"""
Configuration Django de Kakatar Academy.

Toutes les valeurs sensibles ou dépendantes de l'environnement sont lues depuis
les variables d'environnement (ou un fichier backend/.env). Voir `.env.example`.
Seule DATABASE_URL (PostgreSQL) est obligatoire. Sans autre configuration, le projet
démarre en mode développement avec un cache mémoire, les emails dans la console et des
paiements en mode sandbox.
"""
import os
from pathlib import Path
from datetime import timedelta

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env')

# ---------------------------------------------------------------------------
# Sécurité
# ---------------------------------------------------------------------------
DEBUG = env.bool('DEBUG', default=True)
SECRET_KEY = env('SECRET_KEY', default='') or 'django-insecure-dev-only-change-me'
if not DEBUG and SECRET_KEY.startswith('django-insecure'):
    raise RuntimeError('SECRET_KEY doit être défini en production.')

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1', 'backend'])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=['http://localhost', 'http://localhost:5173'])

FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:5173')
BACKEND_URL = env('BACKEND_URL', default='http://localhost:8000')

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Tierces
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'storages',
    'graphene_django',
    'django_prometheus',

    # Locales
    'users',
    'courses',
    'payments',
    'sessions_live',
    'marketplace',
    'analytics',
    'ai_services',
    'notifications',
    'community',
    'assignments',
    'paths',
    'cohorts',
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'kakatar_academy.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'kakatar_academy.wsgi.application'
ASGI_APPLICATION = 'kakatar_academy.asgi.application'

# ---------------------------------------------------------------------------
# Base de données : PostgreSQL uniquement (dev, tests et production).
# DATABASE_URL=postgres://user:motdepasse@hote:5432/kakatar_academy
# ---------------------------------------------------------------------------
DATABASE_URL = env('DATABASE_URL', default='')
if not DATABASE_URL:
    raise RuntimeError(
        'DATABASE_URL est obligatoire (PostgreSQL). Exemple dans backend/.env :\n'
        'DATABASE_URL=postgres://kakatar:motdepasse@localhost:5432/kakatar_academy'
    )
DATABASES = {'default': env.db_url_config(DATABASE_URL)}
if DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise RuntimeError('Seul PostgreSQL est pris en charge (DATABASE_URL doit commencer par postgres://).')
# Connexions persistantes en production (gunicorn). En développement, le serveur Django crée un thread
# par requête : des connexions persistantes s'y accumuleraient jusqu'à saturer PostgreSQL.
DATABASES['default'].setdefault('CONN_MAX_AGE', env.int('DB_CONN_MAX_AGE', default=0 if DEBUG else 60))
DATABASES['default'].setdefault('CONN_HEALTH_CHECKS', True)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
REDIS_URL = env('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}}
else:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default=REDIS_URL or 'memory://')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default=REDIS_URL or 'cache+memory://')
CELERY_TASK_ALWAYS_EAGER = env.bool('CELERY_TASK_ALWAYS_EAGER', default=not bool(REDIS_URL))
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TIMEZONE = 'Africa/Abidjan'
CELERY_BEAT_SCHEDULE = {
    'expire-subscriptions': {
        'task': 'payments.tasks.expire_subscriptions',
        'schedule': 60 * 60,
    },
    'session-reminders': {
        'task': 'sessions_live.tasks.send_session_reminders',
        'schedule': 15 * 60,
    },
    'daily-learning-reminders': {
        'task': 'analytics.tasks.send_daily_reminders',
        'schedule': 60 * 60,
    },
    'daily-platform-snapshot': {
        'task': 'analytics.tasks.compute_daily_snapshot',
        'schedule': 24 * 60 * 60,
    },
}

# ---------------------------------------------------------------------------
# Mots de passe
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'users.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
PASSWORD_RESET_TIMEOUT = 60 * 60  # 1 heure

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Abidjan'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Fichiers statiques & médias
# ---------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_ROOT.mkdir(exist_ok=True)
STATICFILES_DIRS = [p for p in [BASE_DIR / 'static'] if p.exists()]
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
MAX_VIDEO_UPLOAD_SIZE = env.int('MAX_VIDEO_UPLOAD_SIZE', default=2 * 1024 * 1024 * 1024)

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

USE_S3 = env.bool('USE_S3', default=False)
if USE_S3:
    # Compatible AWS S3 et Cloudflare R2 (AWS_S3_ENDPOINT_URL)
    AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', default='auto')
    AWS_S3_ENDPOINT_URL = env('AWS_S3_ENDPOINT_URL', default='') or None
    AWS_S3_CUSTOM_DOMAIN = env('AWS_S3_CUSTOM_DOMAIN', default='') or None
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True  # URLs signées : les vidéos restent privées
    AWS_QUERYSTRING_EXPIRE = 3600
    STORAGES['default'] = {'BACKEND': 'storages.backends.s3.S3Storage'}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Django REST Framework & JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_PAGINATION_CLASS': 'kakatar_academy.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': env('THROTTLE_ANON', default='100/minute'),
        'user': env('THROTTLE_USER', default='1000/minute'),
        'auth': env('THROTTLE_AUTH', default='10/minute'),
        'ai': env('THROTTLE_AI', default='20/hour'),
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env.int('JWT_ACCESS_MINUTES', default=60)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env.int('JWT_REFRESH_DAYS', default=7)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

GRAPHENE = {'SCHEMA': 'kakatar_academy.schema.schema'}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
])
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Emails (console en développement, SMTP sinon)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend' if DEBUG
    else 'django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Kakatar Academy <noreply@kakataracademy.com>')

# ---------------------------------------------------------------------------
# Paiements
# Sans clé configurée pour une passerelle, elle fonctionne en mode « sandbox » :
# le paiement est simulé (utile en dev et pour les tests). Désactivable via
# PAYMENTS_ALLOW_SANDBOX=False en production.
# ---------------------------------------------------------------------------
PAYMENTS_ALLOW_SANDBOX = env.bool('PAYMENTS_ALLOW_SANDBOX', default=DEBUG)
PLATFORM_COMMISSION_RATE = env.float('PLATFORM_COMMISSION_RATE', default=15.0)
PAYOUT_MINIMUM = env.int('PAYOUT_MINIMUM', default=5000)  # montant minimum d'une demande de versement
REFERRAL_REWARD_PERCENT = env.int('REFERRAL_REWARD_PERCENT', default=20)  # code offert au parrain
DEFAULT_CURRENCY = env('DEFAULT_CURRENCY', default='XOF')

STRIPE_PUBLISHABLE_KEY = env('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY', default='')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='')

PAYDUNYA_MODE = env('PAYDUNYA_MODE', default='test')  # test | live
PAYDUNYA_MASTER_KEY = env('PAYDUNYA_MASTER_KEY', default='')
PAYDUNYA_PUBLIC_KEY = env('PAYDUNYA_PUBLIC_KEY', default='')
PAYDUNYA_PRIVATE_KEY = env('PAYDUNYA_PRIVATE_KEY', default='')
PAYDUNYA_TOKEN = env('PAYDUNYA_TOKEN', default='')

WAVE_API_KEY = env('WAVE_API_KEY', default='')
WAVE_WEBHOOK_SECRET = env('WAVE_WEBHOOK_SECRET', default='')

SUBSCRIPTION_PLANS = {
    'BASIC': {'name': 'Basique', 'monthly_price': 5000},
    'PREMIUM': {'name': 'Premium', 'monthly_price': 15000},
    'ENTERPRISE': {'name': 'Entreprise', 'monthly_price': 50000},
}

# ---------------------------------------------------------------------------
# IA (OpenAI). Sans clé, les services IA utilisent des heuristiques locales.
# ---------------------------------------------------------------------------
OPENAI_API_KEY = env('OPENAI_API_KEY', default='')
OPENAI_MODEL = env('OPENAI_MODEL', default='gpt-4o-mini')

# ---------------------------------------------------------------------------
# Sessions en direct (Jitsi par défaut : aucune clé nécessaire)
# ---------------------------------------------------------------------------
LIVE_MEETING_BASE_URL = env('LIVE_MEETING_BASE_URL', default='https://meet.jit.si')

# ---------------------------------------------------------------------------
# Vidéo : transcodage HLS via ffmpeg (si présent sur la machine)
# ---------------------------------------------------------------------------
FFMPEG_BINARY = env('FFMPEG_BINARY', default='ffmpeg')
# Derrière Nginx : Django autorise, Nginx sert le fichier vidéo (X-Accel-Redirect)
MEDIA_X_ACCEL = env.bool('MEDIA_X_ACCEL', default=False)

# ---------------------------------------------------------------------------
# Journalisation
# ---------------------------------------------------------------------------
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(exist_ok=True)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {module} {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'django.log',
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 3,
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
    },
    'root': {'handlers': ['console', 'file'], 'level': env('LOG_LEVEL', default='INFO')},
    'loggers': {
        'django': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
    },
}

# ---------------------------------------------------------------------------
# Sentry
# ---------------------------------------------------------------------------
SENTRY_DSN = env('SENTRY_DSN', default='')
if SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=env.float('SENTRY_TRACES_RATE', default=0.1),
                    send_default_pii=False)

# ---------------------------------------------------------------------------
# En-têtes de sécurité
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=True)
    SECURE_REDIRECT_EXEMPT = [r'^health/$', r'^metrics$']
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
