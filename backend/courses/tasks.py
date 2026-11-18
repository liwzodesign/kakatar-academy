"""Traitement vidéo : transcodage HLS multi-débits avec ffmpeg."""
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# (nom, hauteur, débit vidéo, débit audio)
RENDITIONS = [('360p', 360, '800k', '96k'), ('720p', 720, '2800k', '128k')]


def _probe_duration(path):
    ffprobe = shutil.which('ffprobe')
    if not ffprobe:
        return 0
    try:
        out = subprocess.run([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of',
                              'default=noprint_wrappers=1:nokey=1', str(path)],
                             capture_output=True, text=True, timeout=60, check=True)
        return int(float(out.stdout.strip()))
    except Exception:
        return 0


@shared_task(bind=True, max_retries=2)
def transcode_lesson_to_hls(self, lesson_id):
    from .models import Lesson

    lesson = Lesson.objects.filter(id=lesson_id).first()
    if not lesson or not lesson.video_file:
        return
    ffmpeg = shutil.which(settings.FFMPEG_BINARY)
    if not ffmpeg:
        # Sans ffmpeg, la vidéo reste lisible en téléchargement progressif (MP4).
        logger.warning('ffmpeg introuvable : la leçon %s est servie sans HLS.', lesson_id)
        lesson.video_status = Lesson.VideoStatus.READY
        lesson.save(update_fields=['video_status'])
        return

    lesson.video_status = Lesson.VideoStatus.PROCESSING
    lesson.save(update_fields=['video_status'])
    workdir = Path(tempfile.mkdtemp(prefix='hls_'))
    try:
        source = workdir / 'source'
        with lesson.video_file.open('rb') as src, open(source, 'wb') as dst:
            shutil.copyfileobj(src, dst)

        master_lines = ['#EXTM3U', '#EXT-X-VERSION:3']
        for name, height, v_bitrate, a_bitrate in RENDITIONS:
            out_dir = workdir / name
            out_dir.mkdir()
            subprocess.run([
                ffmpeg, '-y', '-i', str(source), '-vf', f'scale=-2:{height}', '-c:v', 'libx264',
                '-preset', 'veryfast', '-b:v', v_bitrate, '-c:a', 'aac', '-b:a', a_bitrate,
                '-hls_time', '6', '-hls_playlist_type', 'vod',
                '-hls_segment_filename', str(out_dir / 'seg_%04d.ts'), str(out_dir / 'index.m3u8'),
            ], check=True, capture_output=True, timeout=60 * 60)
            bandwidth = (int(v_bitrate.rstrip('k')) + int(a_bitrate.rstrip('k'))) * 1000
            master_lines += [f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth}', f'{name}/index.m3u8']
        (workdir / 'master.m3u8').write_text('\n'.join(master_lines) + '\n')

        prefix = f'lessons/hls/{lesson.id}'
        for path in workdir.rglob('*'):
            if path.is_file() and path.name != 'source':
                key = f"{prefix}/{path.relative_to(workdir).as_posix()}"
                if default_storage.exists(key):
                    default_storage.delete(key)
                with open(path, 'rb') as fh:
                    default_storage.save(key, File(fh))

        lesson.hls_playlist = f'{prefix}/master.m3u8'
        lesson.video_duration = _probe_duration(source) or lesson.video_duration
        lesson.video_status = Lesson.VideoStatus.READY
        lesson.save(update_fields=['hls_playlist', 'video_duration', 'video_status'])
        lesson.module.course.update_stats()
    except Exception as exc:
        logger.exception('Échec du transcodage HLS de la leçon %s', lesson_id)
        lesson.video_status = Lesson.VideoStatus.FAILED
        lesson.save(update_fields=['video_status'])
        if self.request.retries < self.max_retries and not settings.CELERY_TASK_ALWAYS_EAGER:
            raise self.retry(exc=exc, countdown=60)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
