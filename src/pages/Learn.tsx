import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, Lock, Menu, X } from 'lucide-react';
import { Button, ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { api, downloadFile } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { CourseDetail, Lesson } from '../types';

/** Transforme une URL YouTube / Vimeo en URL d'intégration ; sinon null (lecture <video>). */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { /* URL invalide */ }
  return null;
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const embed = lesson.video_url ? embedUrl(lesson.video_url) : null;
  return (
    <article className="space-y-6">
      {lesson.video_url && (
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {embed ? (
            <iframe src={embed} title={lesson.title} className="h-full w-full"
              allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <video src={lesson.video_url} controls className="h-full w-full" preload="metadata" />
          )}
        </div>
      )}
      <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
      {lesson.description && <p className="text-gray-600">{lesson.description}</p>}
      {lesson.content && (
        <div className="whitespace-pre-line leading-relaxed text-gray-800">{lesson.content}</div>
      )}
      {lesson.resources?.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-gray-900">Ressources</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lesson.resources.map((r, i) => (
              <li key={i}><a href={r.url} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline">{r.title || r.url}</a></li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function Learn() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const course = useApi<CourseDetail>(`/courses/${slug}/`);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonError, setLessonError] = useState<Error | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [certificate, setCertificate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const lessons = useMemo(() => course.data?.modules.flatMap((m) => m.lessons) ?? [], [course.data]);

  useEffect(() => {
    const ep = course.data?.enrollment_progress;
    if (ep) {
      setCompleted(new Set(ep.completed_lessons));
      setProgress(Number(ep.progress));
      setCertificate(ep.certificate_issued);
    }
  }, [course.data]);

  const currentId = lessonId
    || course.data?.enrollment_progress?.current_lesson
    || lessons.find((l) => !completed.has(l.id) && !l.is_locked)?.id
    || lessons[0]?.id;

  useEffect(() => {
    if (!currentId) return;
    setLesson(null); setLessonError(null); setMenuOpen(false);
    api<Lesson>(`/courses/lessons/${currentId}/`).then(setLesson).catch(setLessonError);
    window.scrollTo({ top: 0 });
  }, [currentId]);

  if (course.loading && !course.data) return <Spinner />;
  if (course.error) return <div className="mx-auto max-w-3xl p-4"><ErrorBox error={course.error} /></div>;
  if (!course.data) return null;
  if (!course.data.is_enrolled && lessons.every((l) => l.is_locked)) {
    return <Navigate to={`/formations/${slug}`} replace />;
  }

  const index = lessons.findIndex((l) => l.id === currentId);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const enrolled = course.data.is_enrolled;

  const markDone = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const r = await api<{ progress: string; certificate_issued: boolean }>(
        `/courses/lessons/${lesson.id}/complete/`, { method: 'POST' });
      setCompleted(new Set([...completed, lesson.id]));
      setProgress(Number(r.progress));
      setCertificate(r.certificate_issued);
      if (next && !next.is_locked) navigate(`/apprendre/${slug}/${next.id}`);
    } catch (e) { setLessonError(e as Error); }
    finally { setSaving(false); }
  };

  const sidebar = (
    <nav className="space-y-4">
      {course.data.modules.map((m) => (
        <div key={m.id}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Module {m.order} · {m.title}</p>
          <ul>
            {m.lessons.map((l) => {
              const active = l.id === currentId;
              const done = completed.has(l.id);
              return (
                <li key={l.id}>
                  {l.is_locked ? (
                    <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-400">
                      <Lock className="h-4 w-4 shrink-0" />{l.title}
                    </span>
                  ) : (
                    <Link to={`/apprendre/${slug}/${l.id}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                        active ? 'bg-brand-50 font-medium text-brand-800' : 'text-gray-700 hover:bg-gray-100'}`}>
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-gray-300" />}
                      {l.title}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link to={`/formations/${slug}`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> {course.data.title}
        </Link>
        <button className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm lg:hidden"
          onClick={() => setMenuOpen(true)}><Menu className="h-4 w-4" /> Sommaire</button>
      </div>

      {enrolled && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Progression</span><span>{Math.round(progress)} %</span></div>
          <ProgressBar value={progress} />
          {certificate && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-50 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-green-800"><Award className="h-5 w-5" /> Bravo, formation terminée !</p>
              <Button variant="secondary" onClick={() => downloadFile(`/courses/${slug}/certificate/`, `certificat-${slug}.pdf`)}>
                <Download className="h-4 w-4" /> Télécharger le certificat
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {lessonError && <ErrorBox error={lessonError} />}
          {!lesson && !lessonError && <Spinner />}
          {lesson && <LessonView lesson={lesson} />}
          {lesson && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6">
              <Button variant="ghost" disabled={!prev || prev.is_locked}
                onClick={() => prev && navigate(`/apprendre/${slug}/${prev.id}`)}><ChevronLeft className="h-4 w-4" /> Précédente</Button>
              {enrolled && !completed.has(lesson.id) && (
                <Button loading={saving} onClick={markDone}><CheckCircle2 className="h-4 w-4" /> Marquer comme terminée</Button>
              )}
              {!enrolled && (
                <Link to={`/formations/${slug}`} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">
                  S'inscrire pour continuer
                </Link>
              )}
              <Button variant="ghost" disabled={!next || next.is_locked}
                onClick={() => next && navigate(`/apprendre/${slug}/${next.id}`)}>Suivante <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">{sidebar}</div>
        </aside>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4">
            <button className="mb-4 ml-auto flex" onClick={() => setMenuOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
