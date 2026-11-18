/**
 * Leçons enregistrées hors connexion (Cache API du navigateur).
 * - Le contenu de la leçon (JSON) et sa vidéo MP4 sont stockés sur l'appareil.
 * - Rien n'est envoyé à des tiers ; tout peut être supprimé depuis « Téléchargements ».
 */
import { api } from './api';

const CACHE = 'kakatar-offline-v1';
const lessonKey = (id: string) => `/__offline__/lesson/${id}`;
const videoKey = (id: string) => `/__offline__/video/${id}`;

export interface OfflineLesson {
  lessonId: string;
  title: string;
  type: string;
  content: string;
  summary: string;
  courseSlug: string;
  courseTitle: string;
  thumbnail: string;
  hasVideo: boolean;
  videoBytes: number;
  savedAt: string;
}

export const offlineSupported = () => typeof window !== 'undefined' && 'caches' in window;

export async function isLessonSaved(lessonId: string): Promise<boolean> {
  if (!offlineSupported()) return false;
  const cache = await caches.open(CACHE);
  return !!(await cache.match(lessonKey(lessonId)));
}

/** Enregistre une leçon ; `onProgress` reçoit 0–100 pendant le téléchargement de la vidéo. */
export async function saveLesson(lessonId: string, onProgress?: (pct: number) => void): Promise<OfflineLesson> {
  if (!offlineSupported()) throw new Error("Votre navigateur ne permet pas l'enregistrement hors connexion.");
  const pkg = await api.get(`/courses/lessons/${lessonId}/offline/`);
  if (!pkg.video_downloadable) throw new Error(pkg.reason || 'Cette leçon ne peut pas être enregistrée.');
  const cache = await caches.open(CACHE);

  let videoBytes = 0;
  if (pkg.video_download_url) {
    let response: Response;
    try {
      response = await fetch(pkg.video_download_url);
    } catch {
      throw new Error("La vidéo n'a pas pu être téléchargée (connexion ou source externe).");
    }
    if (!response.ok || !response.body) throw new Error("La vidéo n'a pas pu être téléchargée.");
    const total = Number(response.headers.get('Content-Length')) || pkg.video_size || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      videoBytes += value.length;
      if (total) onProgress?.(Math.min(99, Math.round((videoBytes / total) * 100)));
    }
    const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('Content-Type') || 'video/mp4' });
    await cache.put(videoKey(lessonId), new Response(blob, { headers: { 'Content-Type': blob.type } }));
  }

  const lesson = pkg.lesson;
  const record: OfflineLesson = {
    lessonId,
    title: lesson.title,
    type: lesson.type,
    content: lesson.content || '',
    summary: lesson.summary || '',
    courseSlug: pkg.course.slug,
    courseTitle: pkg.course.title,
    thumbnail: pkg.course.thumbnail || '',
    hasVideo: videoBytes > 0,
    videoBytes,
    savedAt: new Date().toISOString(),
  };
  await cache.put(lessonKey(lessonId), new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }));
  onProgress?.(100);
  return record;
}

export async function listSavedLessons(): Promise<OfflineLesson[]> {
  if (!offlineSupported()) return [];
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const items = await Promise.all(
    keys.filter((r) => new URL(r.url).pathname.startsWith('/__offline__/lesson/'))
      .map(async (r) => (await cache.match(r))!.json() as Promise<OfflineLesson>)
  );
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** URL locale (blob:) de la vidéo enregistrée, ou null. Penser à `URL.revokeObjectURL` après usage. */
export async function offlineVideoUrl(lessonId: string): Promise<string | null> {
  if (!offlineSupported()) return null;
  const response = await (await caches.open(CACHE)).match(videoKey(lessonId));
  return response ? URL.createObjectURL(await response.blob()) : null;
}

export async function removeLesson(lessonId: string) {
  const cache = await caches.open(CACHE);
  await Promise.all([cache.delete(lessonKey(lessonId)), cache.delete(videoKey(lessonId))]);
}

export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { used: usage, quota };
}

export const formatBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} Go` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1e3))} Ko`;
