"""
Accès protégé aux vidéos des leçons.

Les fichiers vidéo (MP4 téléversés et segments HLS) ne sont jamais servis par une URL publique :
chaque inscrit reçoit un lien signé, personnel et temporaire (6 h) de la forme
    /api/v1/courses/media/<jeton>/video            (fichier MP4 d'origine)
    /api/v1/courses/media/<jeton>/master.m3u8      (playlist HLS ; les segments sont relatifs au jeton)
Django vérifie le jeton ET les droits actuels de l'utilisateur, puis Nginx sert le fichier
(X-Accel-Redirect) — en développement, Django le sert directement.
"""
import mimetypes
import posixpath

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage, default_storage
from django.http import FileResponse, Http404, HttpResponse, HttpResponseForbidden, HttpResponseRedirect

TOKEN_MAX_AGE = 6 * 60 * 60
SALT = 'kakatar.lesson-media'


def make_token(lesson, user):
    return signing.dumps({'l': str(lesson.id), 'u': str(user.id) if user and user.is_authenticated else ''}, salt=SALT,
                         compress=True)


def playback_path(lesson, user):
    """URL relative de lecture pour cet utilisateur, ou '' si la leçon n'a pas de vidéo hébergée."""
    if not lesson.video_file:
        return ''
    base = f"/api/v1/courses/media/{make_token(lesson, user)}"
    if lesson.video_status == lesson.VideoStatus.READY and lesson.hls_playlist:
        return f'{base}/master.m3u8'
    return f'{base}/video'


def user_can_watch(user, lesson):
    course = lesson.module.course
    if lesson.is_free or lesson.module.is_free:
        return True
    if not user or not user.is_authenticated:
        return False
    if user.role == 'ADMIN' or course.instructor_id == user.id:
        return True
    return user.enrollments.filter(course=course, status__in=['ACTIVE', 'COMPLETED']).exists()


def serve_lesson_media(request, token, subpath):
    from users.models import User
    from .models import Lesson

    try:
        data = signing.loads(token, salt=SALT, max_age=TOKEN_MAX_AGE)
    except signing.SignatureExpired:
        return HttpResponseForbidden('Lien expiré : rechargez la leçon.')
    except signing.BadSignature:
        return HttpResponseForbidden('Lien invalide.')

    lesson = Lesson.objects.select_related('module__course').filter(id=data.get('l')).first()
    if not lesson:
        raise Http404
    user = User.objects.filter(id=data['u']).first() if data.get('u') else None
    if not user_can_watch(user, lesson):  # droits revérifiés à chaque requête (ex. remboursement)
        return HttpResponseForbidden('Accès refusé.')

    if subpath == 'video':
        if not lesson.video_file:
            raise Http404
        name = lesson.video_file.name
    else:
        prefix = f'lessons/hls/{lesson.id}/'
        name = posixpath.normpath(prefix + subpath)
        if not name.startswith(prefix) or '..' in subpath.split('/'):
            raise Http404
    if not default_storage.exists(name):
        raise Http404

    if not isinstance(default_storage, FileSystemStorage):
        # Stockage S3 / R2 : URL signée par le fournisseur
        return HttpResponseRedirect(default_storage.url(name))

    content_type = mimetypes.guess_type(name)[0] or (
        'application/vnd.apple.mpegurl' if name.endswith('.m3u8') else 'video/mp2t' if name.endswith('.ts')
        else 'application/octet-stream')
    if getattr(settings, 'MEDIA_X_ACCEL', False):
        response = HttpResponse(content_type=content_type)
        response['X-Accel-Redirect'] = f'/protected-media/{name}'
    else:
        response = FileResponse(default_storage.open(name, 'rb'), content_type=content_type)
    response['Cache-Control'] = 'private, max-age=3600'
    return response
