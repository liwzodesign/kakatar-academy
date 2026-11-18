import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Bookmark, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Lock, Sparkles, Award, FileText, HelpCircle,
  Send, BookOpen, MessageSquare, NotebookPen, Megaphone, Gauge, Download, WifiOff, PanelLeftClose, PanelLeftOpen, X, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Hls from 'hls.js';
import DOMPurify from 'dompurify';
import { api } from '../../lib/api';
import { mapCourseDetail } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { LessonDiscussion } from './LessonDiscussion';
import { AssignmentPanel } from './AssignmentPanel';
import { CourseAnnouncements } from './CourseAnnouncements';
import { Lesson, Module } from '../../types';
import { ErrorBox, Spinner } from '../UI';
import { ProgressBar, ProgressRing, Tabs } from '../UI/kit';
import { isLessonSaved, offlineSupported, offlineVideoUrl, removeLesson, saveLesson } from '../../lib/offline';
import { useDataSaver } from '../../lib/dataSaver';
import { ListenButton, htmlToText } from './ListenButton';

interface CoursePlayerProps {
  slug: string;
  initialLessonId?: string | null;
  initialPanel?: string | null;
}

type Note = { time: number; text: string };
type Panel = 'content' | 'discussion' | 'announcements' | 'tutor' | 'summary' | 'notes';

const notesKey = (lessonId: string) => `kakatar_notes_${lessonId}`;
const readNotes = (lessonId: string): Note[] => {
  try {
    return JSON.parse(localStorage.getItem(notesKey(lessonId)) || '[]');
  } catch {
    return [];
  }
};

/** « Module 2 : Mise en pratique » → « Mise en pratique » (le numéro est déjà affiché). */
const stripModulePrefix = (t: string) => t.replace(/^module\s*\d+\s*[:\-–—]\s*/i, '') || t;

const formatTime = (time: number) => `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  VIDEO: { icon: Play, label: 'Vidéo' },
  QUIZ: { icon: HelpCircle, label: 'Quiz' },
  TEXT: { icon: FileText, label: 'Lecture' },
  PROJECT: { icon: BookOpen, label: 'Projet' },
  RESOURCE: { icon: FileText, label: 'Ressource' },
  ASSIGNMENT: { icon: BookOpen, label: 'Devoir' },
};

/** Lecteur vidéo : HLS (adaptatif) si la source est une playlist .m3u8, sinon lecture native ou intégration. */
const VideoPlayer: React.FC<{
  src: string;
  onEnded: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  dataSaver: boolean;
  offline: boolean;
}> = ({ src, onEnded, videoRef, dataSaver, offline }) => {
  // En économie de données, la vidéo ne se charge qu'à la demande (sauf copie locale)
  const [started, setStarted] = useState(!dataSaver || offline);
  useEffect(() => setStarted(!dataSaver || offline), [src, dataSaver, offline]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !started) return;
    if (src.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls(dataSaver
        ? { startLevel: 0, capLevelToPlayerSize: true, maxBufferLength: 15, maxMaxBufferLength: 30 }
        : { capLevelToPlayerSize: true });
      if (dataSaver) hls.on(Hls.Events.MANIFEST_PARSED, () => { hls.autoLevelCapping = 0; });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = src;
  }, [src, videoRef, started, dataSaver]);

  const embed = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/) || src.match(/vimeo\.com\/(\d+)/);
  if (!started) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-gradient-to-br from-primary-950 to-primary-800 text-white">
        <Gauge className="w-9 h-9 text-secondary-300" />
        <p className="font-semibold">Mode économie de données</p>
        <p className="text-sm text-white/70 max-w-sm">La vidéo est chargée uniquement à votre demande, dans la qualité la plus légère.</p>
        <button onClick={() => setStarted(true)} className="mt-1 flex items-center gap-2 bg-white text-primary-900 font-bold px-5 py-2.5 rounded-xl">
          <Play className="w-4 h-4" />Charger la vidéo
        </button>
      </div>
    );
  }
  if (embed) {
    const url = src.includes('vimeo') ? `https://player.vimeo.com/video/${embed[1]}` : `https://www.youtube-nocookie.com/embed/${embed[1]}`;
    return <iframe src={url} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Vidéo de la leçon" />;
  }
  return <video ref={videoRef} className="w-full h-full object-contain bg-black" controls controlsList="nodownload" playsInline
    preload={dataSaver ? 'none' : 'metadata'} onEnded={onEnded} />;
};

/** Bouton « Enregistrer hors connexion » d'une leçon. */
const OfflineButton: React.FC<{ lessonId: string; onChange: () => void }> = ({ lessonId, onChange }) => {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setProgress(null);
    isLessonSaved(lessonId).then(setSaved);
  }, [lessonId]);

  if (!offlineSupported() || saved === null) return null;

  const save = async () => {
    setError('');
    setProgress(0);
    try {
      await saveLesson(lessonId, setProgress);
      setSaved(true);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    await removeLesson(lessonId);
    setSaved(false);
    onChange();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {progress !== null ? (
        <span className="flex items-center gap-2 text-sm font-semibold text-primary-700 bg-primary-50 px-3 py-1.5 rounded-full">
          <Download className="w-4 h-4 animate-bounce" />Enregistrement… {progress} %
        </span>
      ) : saved ? (
        <button onClick={remove} title="Supprimer de cet appareil"
          className="group flex items-center gap-1.5 text-sm font-semibold text-secondary-700 bg-secondary-50 ring-1 ring-secondary-200 px-3 py-1.5 rounded-full hover:bg-red-50 hover:text-red-600 hover:ring-red-200">
          <WifiOff className="w-4 h-4" /><span className="group-hover:hidden">Disponible hors connexion</span><span className="hidden group-hover:inline">Supprimer</span>
        </button>
      ) : (
        <button onClick={save} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 bg-white px-3 py-1.5 rounded-full hover:bg-gray-50">
          <Download className="w-4 h-4" />Enregistrer hors connexion
        </button>
      )}
      {error && <span className="text-xs text-red-600 max-w-xs text-right">{error}</span>}
    </div>
  );
};

/** Quiz : options en cartes lettrées, correction détaillée. */
const QuizView: React.FC<{ lesson: Lesson; onPassed: () => void }> = ({ lesson, onPassed }) => {
  const [answers, setAnswers] = useState<number[]>(() => lesson.quiz.map(() => -1));
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAnswers(lesson.quiz.map(() => -1));
    setResult(null);
  }, [lesson.id, lesson.quiz]);

  const answered = answers.filter((a) => a >= 0).length;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post(`/courses/lessons/${lesson.id}/quiz/`, { answers });
      setResult(res);
      if (res.passed) onPassed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers(lesson.quiz.map(() => -1));
  };

  return (
    <div className="space-y-5">
      {result && (
        <div className={`flex items-center gap-4 p-5 rounded-2xl ${result.passed ? 'bg-secondary-50 ring-1 ring-secondary-200' : 'bg-sun-50 ring-1 ring-sun-100'}`}>
          <span className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-extrabold ${result.passed ? 'bg-secondary-500 text-white' : 'bg-sun-500 text-primary-950'}`}>
            {Number(result.score).toFixed(0)}%
          </span>
          <div className="flex-1">
            <p className="font-bold text-gray-900">{result.passed ? 'Quiz réussi, bravo !' : 'Presque ! Encore un effort.'}</p>
            <p className="text-sm text-gray-600">{result.passed ? 'La leçon est validée.' : `Il faut ${lesson.passingScore} % pour valider. Relisez les explications puis réessayez.`}</p>
          </div>
          {!result.passed && <button onClick={retry} className="px-4 py-2 rounded-xl bg-white ring-1 ring-gray-200 font-semibold text-sm hover:bg-gray-50">Réessayer</button>}
        </div>
      )}

      {lesson.quiz.map((q, qi) => {
        const correction = result?.corrections?.[qi];
        return (
          <fieldset key={qi} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 sm:p-6">
            <legend className="sr-only">Question {qi + 1}</legend>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Question {qi + 1} / {lesson.quiz.length}</p>
            <p className="mt-1.5 text-lg font-bold text-gray-900">{q.question}</p>
            <div className="mt-4 grid gap-2.5">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const isAnswer = correction && correction.answer === oi;
                const isWrong = correction && !correction.correct && selected;
                return (
                  <label
                    key={oi}
                    className={`flex items-center gap-3 p-3.5 rounded-xl ring-1 cursor-pointer transition-all ${
                      isAnswer ? 'ring-2 ring-secondary-500 bg-secondary-50'
                        : isWrong ? 'ring-2 ring-rose-500 bg-rose-100/50'
                        : selected ? 'ring-2 ring-primary-500 bg-primary-50'
                        : 'ring-gray-200 hover:ring-gray-300 hover:bg-gray-50'
                    } ${result ? 'cursor-default' : ''}`}
                  >
                    <input type="radio" name={`q${qi}`} className="sr-only" checked={selected} disabled={!!result}
                      onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))} />
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isAnswer ? 'bg-secondary-500 text-white' : isWrong ? 'bg-rose-500 text-white' : selected ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isAnswer ? <Check className="w-4 h-4" /> : isWrong ? <X className="w-4 h-4" /> : String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-gray-800">{opt}</span>
                  </label>
                );
              })}
            </div>
            {correction?.explanation && !correction.correct && (
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">💡 {correction.explanation}</p>
            )}
          </fieldset>
        );
      })}

      {error && <ErrorBox message={error} />}
      {!result && (
        <div className="flex items-center justify-between gap-4 sticky bottom-4 bg-white/90 backdrop-blur rounded-2xl ring-1 ring-gray-100 shadow-lift p-3 pl-5">
          <span className="text-sm text-gray-600">{answered} / {lesson.quiz.length} réponses</span>
          <button onClick={submit} disabled={busy || answered < lesson.quiz.length}
            className="bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-primary-800 transition-colors">
            {busy ? 'Correction…' : 'Valider mes réponses'}
          </button>
        </div>
      )}
    </div>
  );
};

/** Programme du cours (barre latérale du lecteur). */
const Curriculum: React.FC<{
  modules: Module[];
  currentId: string | null;
  onSelect: (l: Lesson) => void;
}> = ({ modules, currentId, onSelect }) => {
  const currentModule = modules.find((m) => m.lessons.some((l) => l.id === currentId))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(modules.map((m) => [m.id, m.id === currentModule || modules.length <= 3])));

  return (
    <nav aria-label="Programme du cours" className="divide-y divide-gray-100">
      {modules.map((m, mi) => {
        const done = m.lessons.filter((l) => l.completed).length;
        const isOpen = open[m.id] ?? false;
        return (
          <div key={m.id}>
            <button onClick={() => setOpen({ ...open, [m.id]: !isOpen })} aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50">
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-gray-400">Module {mi + 1}</span>
                <span className="block font-bold text-gray-900 text-sm truncate">{stripModulePrefix(m.title)}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{done}/{m.lessons.length} terminées</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="pb-2">
                {m.lessons.map((l) => {
                  const Meta = TYPE_META[l.type] || TYPE_META.TEXT;
                  const active = l.id === currentId;
                  return (
                    <li key={l.id}>
                      <button onClick={() => onSelect(l)} disabled={l.locked} aria-current={active ? 'step' : undefined}
                        className={`relative w-full flex items-center gap-3 pl-5 pr-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                          active ? 'bg-primary-50 text-primary-900' : 'hover:bg-gray-50 text-gray-700'
                        } ${l.locked ? 'opacity-50' : ''}`}>
                        {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-primary-700" />}
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          l.completed ? 'bg-secondary-500 text-white' : active ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {l.completed ? <Check className="w-4 h-4" /> : l.locked ? <Lock className="w-3.5 h-3.5" /> : <Meta.icon className="w-3.5 h-3.5" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block truncate ${active ? 'font-semibold' : ''}`}>{l.title}</span>
                          <span className="block text-xs text-gray-400">{Meta.label}{l.duration ? ` · ${l.duration} min` : ''}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
};

export const CoursePlayer: React.FC<CoursePlayerProps> = ({ slug, initialLessonId, initialPanel }) => {
  const { data: course, loading, error, reload, setData } = useApi(
    async () => mapCourseDetail(await api.get(`/courses/${slug}/`)),
    [slug]
  );
  const { authState } = useAuth();
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(initialLessonId || null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [panel, setPanel] = useState<Panel>(initialPanel === 'discussion' || initialPanel === 'announcements' ? initialPanel : 'content');
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [summary, setSummary] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [certificate, setCertificate] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dataSaver, setDataSaver] = useDataSaver();
  const [offlineSrc, setOfflineSrc] = useState<string | null>(null);
  const [offlineVersion, setOfflineVersion] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const allLessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) || [], [course]);

  useEffect(() => {
    if (!course || currentLessonId) return;
    const target = course.enrollment?.currentLesson || allLessons.find((l) => !l.locked)?.id || null;
    setCurrentLessonId(target);
  }, [course, allLessons, currentLessonId]);

  const currentLesson = allLessons.find((l) => l.id === currentLessonId);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  useEffect(() => {
    if (!currentLessonId) return;
    setNotes(readNotes(currentLessonId));
    setChat([]);
    setSummary('');
    setActionError('');
    mainRef.current?.scrollTo({ top: 0 });
    const url = new URL(window.location.href);
    url.searchParams.set('lesson', currentLessonId);
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [currentLessonId]);

  // Vidéo enregistrée sur l'appareil : lue en priorité (aucune donnée consommée)
  useEffect(() => {
    if (!currentLessonId) return;
    let url: string | null = null;
    let cancelled = false;
    offlineVideoUrl(currentLessonId).then((u) => {
      if (cancelled) { if (u) URL.revokeObjectURL(u); return; }
      url = u;
      setOfflineSrc(u);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setOfflineSrc(null);
    };
  }, [currentLessonId, offlineVersion]);

  // Raccourcis clavier : ← / → pour changer de leçon (hors saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.altKey && e.key === 'ArrowRight') goTo(allLessons[currentIndex + 1]);
      if (e.altKey && e.key === 'ArrowLeft') goTo(allLessons[currentIndex - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading && !course) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (error || !course) return <div className="p-8"><ErrorBox message={error || 'Cours introuvable'} onRetry={reload} /></div>;

  if (!course.isEnrolled && !course.isOwner && allLessons.every((l) => l.locked)) {
    return <div className="p-8"><ErrorBox message="Vous devez être inscrit à ce cours pour y accéder." onRetry={() => navigate(`/courses/${slug}`)} /></div>;
  }

  const progress = course.enrollment?.progress ?? 0;
  const nextLesson = allLessons[currentIndex + 1];
  const prevLesson = allLessons[currentIndex - 1];

  function goTo(lesson?: Lesson) {
    if (!lesson || lesson.locked) return;
    setCurrentLessonId(lesson.id);
    setPanel('content');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }

  const markAsCompleted = async () => {
    if (!currentLesson || !course) return;
    setActionError('');
    setCompleting(true);
    try {
      const res = await api.post(`/courses/lessons/${currentLesson.id}/complete/`);
      const updated = { ...course };
      updated.modules = course.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === currentLesson.id ? { ...l, completed: true } : l)),
      }));
      updated.enrollment = updated.enrollment && {
        ...updated.enrollment,
        progress: res.progress,
        status: res.status,
        completedLessons: [...updated.enrollment.completedLessons, currentLesson.id],
      };
      setData(updated);
      if (res.certificate_code) setCertificate(res.certificate_code);
      else if (res.next_lesson && res.next_lesson !== currentLesson.id) setCurrentLessonId(res.next_lesson);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const addNote = (text: string) => {
    if (!currentLessonId) return;
    const time = videoRef.current?.currentTime || 0;
    const updated = [...notes, { time, text }].sort((a, b) => a.time - b.time);
    setNotes(updated);
    try {
      localStorage.setItem(notesKey(currentLessonId), JSON.stringify(updated));
    } catch {
      /* stockage indisponible : notes conservées pour la session */
    }
  };

  const askTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !currentLesson) return;
    const q = question;
    setQuestion('');
    setAiBusy(true);
    try {
      const res = await api.post('/ai/tutor/', { lesson_id: currentLesson.id, question: q });
      setChat((c) => [...c, { q, a: res.answer }]);
    } catch (err) {
      setChat((c) => [...c, { q, a: `⚠️ ${(err as Error).message}` }]);
    } finally {
      setAiBusy(false);
    }
  };

  const openPanel = async (p: Panel) => {
    setPanel(p);
    if (p !== 'summary' || summary || !currentLesson) return;
    if (currentLesson.summary) return setSummary(currentLesson.summary);
    setAiBusy(true);
    try {
      setSummary((await api.post(`/ai/lessons/${currentLesson.id}/summary/`)).summary || 'Résumé indisponible.');
    } catch (err) {
      setSummary(`⚠️ ${(err as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const isGraded = !!currentLesson && (currentLesson.type === 'ASSIGNMENT' || currentLesson.type === 'PROJECT');
  const canComplete = course.isEnrolled && currentLesson && !currentLesson.completed && !currentLesson.locked && !isGraded
    && (currentLesson.type !== 'QUIZ' || currentLesson.quiz.length === 0);
  const Meta = currentLesson ? TYPE_META[currentLesson.type] || TYPE_META.TEXT : TYPE_META.TEXT;
  const moduleOfLesson = course.modules.find((m) => m.lessons.some((l) => l.id === currentLessonId));

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-gray-50">
      {/* Barre supérieure du mode concentration */}
      <header className="h-16 flex-shrink-0 flex items-center gap-3 px-3 sm:px-4 bg-primary-900 text-white">
        <button onClick={() => navigate(`/courses/${slug}`)} aria-label="Quitter le lecteur" className="p-2 rounded-xl hover:bg-white/10">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <img src="/logo-mark.svg" alt="" className="h-8 hidden sm:block brightness-0 invert opacity-90" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60 truncate">{course.title}</p>
          <p className="font-semibold truncate">{currentLesson?.title || 'Programme'}</p>
        </div>
        {course.isEnrolled && (
          <div className="hidden md:flex items-center gap-3 pr-2">
            <ProgressRing value={progress} light />
            <span className="text-sm text-white/70 leading-tight">Progression<br /><span className="text-white font-semibold">{course.enrollment?.completedLessons.length || 0}/{allLessons.length} leçons</span></span>
          </div>
        )}
        <button onClick={() => setDataSaver(!dataSaver)} aria-pressed={dataSaver}
          title={dataSaver ? 'Économie de données activée' : 'Activer l’économie de données'}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold ${dataSaver ? 'bg-secondary-500 text-white' : 'hover:bg-white/10 text-white/80'}`}>
          <Gauge className="w-4 h-4" /><span className="hidden sm:inline">{dataSaver ? 'Éco data' : 'Éco data'}</span>
        </button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Masquer le programme' : 'Afficher le programme'}
          className="p-2 rounded-xl hover:bg-white/10">
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </button>
      </header>
      {course.isEnrolled && <div className="md:hidden h-1 bg-primary-950"><div className="h-full bg-secondary-500 transition-all" style={{ width: `${progress}%` }} /></div>}

      <div className="flex-1 flex min-h-0 relative">
        {/* Programme */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)}
                className="lg:hidden absolute inset-0 bg-primary-950/40 z-10" />
              <motion.aside
                initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }} transition={{ type: 'tween', duration: 0.2 }}
                className="absolute lg:static z-20 inset-y-0 left-0 w-[320px] max-w-[85vw] bg-white border-r border-gray-100 flex flex-col"
              >
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Programme du cours</p>
                  {course.isEnrolled && <ProgressBar value={progress} className="mt-3" label="Progression du cours" />}
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Curriculum modules={course.modules} currentId={currentLessonId} onSelect={goTo} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Contenu de la leçon */}
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {certificate && (
            <div className="bg-brand-gradient text-white">
              <div className="max-w-4xl mx-auto px-5 py-5 flex flex-wrap items-center gap-4">
                <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center"><Award className="w-7 h-7 text-sun-400" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg">Félicitations, vous avez terminé le cours ! 🎉</p>
                  <p className="text-white/80 text-sm">Votre certificat n° {certificate} est prêt.</p>
                </div>
                <button onClick={() => navigate(`/certificates/verify/${certificate}`)} className="bg-white text-primary-800 font-bold px-4 py-2.5 rounded-xl">Voir mon certificat</button>
              </div>
            </div>
          )}

          {!currentLesson ? (
            <div className="p-10 text-center text-gray-500">Ce cours ne contient pas encore de leçon.</div>
          ) : currentLesson.locked ? (
            <div className="max-w-md mx-auto p-10 text-center">
              <span className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto"><Lock className="w-7 h-7 text-primary-700" /></span>
              <h2 className="mt-4 text-xl font-extrabold text-gray-900">Leçon réservée aux inscrits</h2>
              <p className="mt-2 text-gray-600">Inscrivez-vous pour débloquer l'ensemble du programme.</p>
              <button onClick={() => navigate(`/courses/${slug}`)} className="mt-6 bg-primary-700 text-white font-semibold px-5 py-3 rounded-xl">Voir le cours</button>
            </div>
          ) : (
            <>
              {currentLesson.type === 'VIDEO' && (
                <div className="bg-black">
                  <div className="max-w-5xl mx-auto aspect-video">
                    {offlineSrc || currentLesson.videoUrl ? (
                      <VideoPlayer src={offlineSrc || currentLesson.videoUrl!} videoRef={videoRef} dataSaver={dataSaver} offline={!!offlineSrc}
                        onEnded={() => !currentLesson.completed && course.isEnrolled && markAsCompleted()} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        {['PROCESSING', 'UPLOADED'].includes(currentLesson.videoStatus || '') ? 'Vidéo en cours de traitement…' : 'Vidéo non disponible'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm text-gray-500">
                      <Meta.icon className="w-4 h-4" />{Meta.label}
                      {moduleOfLesson && <span className="truncate">· {stripModulePrefix(moduleOfLesson.title)}</span>}
                    </p>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900">{currentLesson.title}</h1>
                    {currentLesson.description && <p className="mt-2 text-gray-600">{currentLesson.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                  {course.isEnrolled && <OfflineButton lessonId={currentLesson.id} onChange={() => setOfflineVersion((v) => v + 1)} />}
                  {currentLesson.completed && (
                    <span className="flex items-center gap-1.5 text-secondary-700 bg-secondary-50 ring-1 ring-secondary-200 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Terminée
                    </span>
                  )}
                  </div>
                </div>

                {actionError && <ErrorBox message={actionError} />}

                <Tabs<Panel>
                  value={panel}
                  onChange={openPanel}
                  items={[
                    { value: 'content', label: 'Leçon', icon: BookOpen },
                    { value: 'discussion', label: 'Questions', icon: MessageSquare },
                    { value: 'tutor', label: 'Tuteur IA', icon: Sparkles },
                    { value: 'summary', label: 'Résumé', icon: FileText },
                    { value: 'announcements', label: 'Annonces', icon: Megaphone },
                    { value: 'notes', label: 'Notes', icon: NotebookPen, count: notes.length },
                  ]}
                />

                {panel === 'content' && (
                  currentLesson.type === 'QUIZ' && currentLesson.quiz.length > 0 ? (
                    <QuizView lesson={currentLesson} onPassed={() => course.isEnrolled && markAsCompleted()} />
                  ) : (
                    <div className="space-y-5">
                      {currentLesson.content && <div className="flex justify-end -mb-2"><ListenButton text={htmlToText(currentLesson.content)} /></div>}
                      {currentLesson.content ? (
                        <article
                          className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-6 sm:p-8 text-gray-800 leading-relaxed text-[17px] [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:font-bold [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-primary-700 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(/<[a-z][\s\S]*>/i.test(currentLesson.content) ? currentLesson.content : currentLesson.content.replace(/\n/g, '<br/>')) }}
                        />
                      ) : currentLesson.type !== 'VIDEO' ? (
                        <p className="text-gray-500">Cette leçon n'a pas de contenu texte.</p>
                      ) : null}
                      {currentLesson.resources.length > 0 && (
                        <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-5">
                          <h3 className="font-bold text-gray-900 mb-2">Ressources</h3>
                          <ul className="space-y-1.5">
                            {currentLesson.resources.map((r, i) => (
                              <li key={i}><a href={r.url} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">{r.title || r.url}</a></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isGraded && course.isEnrolled && <AssignmentPanel lessonId={currentLesson.id} />}
                    </div>
                  )
                )}

                {panel === 'announcements' && (course.isEnrolled || course.isOwner) && <CourseAnnouncements slug={course.slug} />}

                {panel === 'discussion' && (course.isEnrolled || course.isOwner) && (
                  <LessonDiscussion lessonId={currentLesson.id} currentUserId={authState.user?.id} />
                )}

                {panel === 'tutor' && (
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card overflow-hidden">
                    <div className="px-5 py-4 bg-primary-50/60 border-b border-primary-100 flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-primary-700 text-white flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
                      <div><p className="font-bold text-gray-900 text-sm">Tuteur IA</p><p className="text-xs text-gray-500">Répond en s'appuyant sur le contenu de cette leçon</p></div>
                    </div>
                    <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto">
                      {chat.length === 0 && (
                        <div className="flex flex-wrap gap-2">
                          {['Peux-tu résumer cette leçon ?', 'Donne-moi un exemple concret', 'Quels sont les points clés ?'].map((s) => (
                            <button key={s} onClick={() => setQuestion(s)} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">{s}</button>
                          ))}
                        </div>
                      )}
                      {chat.map((m, i) => (
                        <div key={i} className="space-y-2">
                          <p className="ml-auto max-w-[85%] w-fit text-sm bg-primary-700 text-white rounded-2xl rounded-br-md px-4 py-2.5">{m.q}</p>
                          <p className="max-w-[85%] w-fit text-sm bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5 whitespace-pre-line">{m.a}</p>
                        </div>
                      ))}
                      {aiBusy && <p className="text-sm text-gray-400 animate-pulse">Le tuteur réfléchit…</p>}
                    </div>
                    <form onSubmit={askTutor} className="flex gap-2 p-3 border-t border-gray-100">
                      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Posez votre question…" aria-label="Question au tuteur"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 outline-none focus:bg-white focus:ring-4 focus:ring-primary-100" />
                      <button disabled={aiBusy || !question.trim()} aria-label="Envoyer" className="w-11 rounded-xl bg-primary-700 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
                    </form>
                  </div>
                )}

                {panel === 'summary' && (
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-6">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-600" />Résumé de la leçon</h3>
                    {aiBusy && !summary ? (
                      <div className="space-y-2"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-11/12" /><div className="skeleton h-4 w-3/4" /></div>
                    ) : <p className="text-gray-700 whitespace-pre-line leading-relaxed">{summary}</p>}
                  </div>
                )}

                {panel === 'notes' && (
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">Mes notes</h3>
                      {currentLesson.type === 'VIDEO' && (
                        <button onClick={() => addNote('🔖 Marque-page')} className="flex items-center gap-1.5 text-sm font-semibold text-primary-700"><Bookmark className="w-4 h-4" />Marque-page à cet instant</button>
                      )}
                    </div>
                    {notes.length === 0 && <p className="text-sm text-gray-500">Aucune note pour cette leçon.</p>}
                    <ul className="space-y-2">
                      {notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm bg-gray-50 rounded-xl p-3">
                          {currentLesson.type === 'VIDEO' && (
                            <button onClick={() => videoRef.current && (videoRef.current.currentTime = n.time)} className="font-mono text-primary-700 font-semibold">{formatTime(n.time)}</button>
                          )}
                          <p className="text-gray-700 flex-1">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ajoutez une note…" aria-label="Nouvelle note"
                        className="flex-1 p-3 rounded-xl ring-1 ring-gray-200 resize-none outline-none focus:ring-4 focus:ring-primary-100" />
                      <button onClick={() => { if (note.trim()) { addNote(note.trim()); setNote(''); } }} className="px-4 rounded-xl bg-primary-700 text-white font-semibold">Ajouter</button>
                    </div>
                    <p className="text-xs text-gray-400">Vos notes sont enregistrées sur cet appareil.</p>
                  </div>
                )}
              </div>
            </>
          )}
          <div className="h-24" />
        </main>
      </div>

      {/* Barre de navigation inférieure */}
      {currentLesson && (
        <footer className="flex-shrink-0 border-t border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-3">
            <button onClick={() => goTo(prevLesson)} disabled={!prevLesson || prevLesson.locked}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Précédente</span>
            </button>
            <div className="flex-1" />
            {canComplete && (
              <button onClick={markAsCompleted} disabled={completing}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold bg-secondary-500 text-white hover:bg-secondary-600 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" />{completing ? 'Enregistrement…' : 'Terminer la leçon'}
              </button>
            )}
            <button onClick={() => goTo(nextLesson)} disabled={!nextLesson || nextLesson.locked}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-30">
              <span className="hidden sm:inline">Suivante</span><ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

