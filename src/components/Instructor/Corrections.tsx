import React, { useState } from 'react';
import { CheckCircle2, Download, Link2, RotateCcw, ClipboardCheck } from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Avatar, EmptyState, ErrorBox, PageHeader, Spinner, inputClass } from '../UI';
import { Badge, Field, Tabs } from '../UI/kit';

interface Submission {
  id: string;
  lesson_title: string;
  course_title: string;
  student: { name: string; email: string; avatar: string };
  text: string;
  link: string;
  has_file: boolean;
  file_name: string;
  status: 'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED';
  status_display: string;
  grade: number | null;
  feedback: string;
  attempts: number;
  updated_at: string;
}

const TONE = { SUBMITTED: 'sun', NEEDS_REVISION: 'rose', APPROVED: 'secondary' } as const;

const ReviewCard: React.FC<{ s: Submission; onDone: () => void }> = ({ s, onDone }) => {
  const [grade, setGrade] = useState<string>(s.grade !== null ? String(s.grade) : '');
  const [feedback, setFeedback] = useState(s.feedback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const review = async (status: 'APPROVED' | 'NEEDS_REVISION') => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/assignments/submissions/${s.id}/review/`, { status, feedback, grade: grade === '' ? null : Number(grade) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <article className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
        <Avatar name={s.student.name} src={s.student.avatar} size="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{s.student.name}</p>
          <p className="text-sm text-gray-500 truncate">{s.course_title} → {s.lesson_title}</p>
        </div>
        <Badge tone={TONE[s.status]}>{s.status_display}</Badge>
        <span className="text-xs text-gray-400">v{s.attempts} · {new Date(s.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
      </header>
      <div className="grid lg:grid-cols-2">
        <div className="p-5 space-y-3 text-sm lg:border-r border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rendu de l'étudiant</p>
          {s.text ? <p className="text-gray-800 whitespace-pre-line">{s.text}</p> : <p className="text-gray-400">Pas de réponse écrite.</p>}
          {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary-700 font-semibold hover:underline break-all"><Link2 className="w-4 h-4 flex-shrink-0" />{s.link}</a>}
          {s.has_file && (
            <button onClick={() => downloadFile(`/assignments/submissions/${s.id}/file/`, s.file_name)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 font-semibold hover:bg-gray-100">
              <Download className="w-4 h-4 text-primary-600" />{s.file_name}
            </button>
          )}
        </div>
        <div className="p-5 space-y-4 bg-gray-50/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Votre correction</p>
          <Field label="Note sur 100" hint="Facultatif">
            <input type="number" min={0} max={100} className={`${inputClass} max-w-[8rem]`} value={grade} onChange={(e) => setGrade(e.target.value)} />
          </Field>
          <Field label="Commentaire" hint="Obligatoire pour demander une reprise.">
            <textarea className={inputClass} rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Points forts, axes d'amélioration…" />
          </Field>
          {error && <ErrorBox message={error} />}
          {s.status !== 'APPROVED' && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => review('APPROVED')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary-500 hover:bg-secondary-600 text-white font-semibold disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" />Valider
              </button>
              <button disabled={busy || !feedback.trim()} onClick={() => review('NEEDS_REVISION')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl ring-1 ring-gray-300 bg-white font-semibold hover:bg-gray-50 disabled:opacity-40">
                <RotateCcw className="w-4 h-4" />Demander une reprise
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const Corrections: React.FC = () => {
  const [status, setStatus] = useState<'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED'>('SUBMITTED');
  const { data, loading, error, reload } = useApi<Submission[]>(() => api.get('/assignments/instructor/', { status }), [status]);

  return (
    <div className="space-y-6">
      <PageHeader title="Corrections" subtitle="Devoirs et projets rendus par vos étudiants" />
      <Tabs value={status} onChange={setStatus} items={[
        { value: 'SUBMITTED', label: 'À corriger', count: status === 'SUBMITTED' ? data?.length : undefined },
        { value: 'NEEDS_REVISION', label: 'En reprise' },
        { value: 'APPROVED', label: 'Validés' },
      ]} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : !data?.length ? (
        <EmptyState title={status === 'SUBMITTED' ? 'Rien à corriger 🎉' : 'Aucun travail ici'}
          text="Ajoutez des leçons de type « Devoir » ou « Projet » à vos cours pour recevoir des travaux." />
      ) : (
        <div className="space-y-5">{data.map((s) => <ReviewCard key={s.id} s={s} onDone={reload} />)}</div>
      )}
      <p className="text-xs text-gray-400 flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" />Une validation termine automatiquement la leçon pour l'étudiant et le prévient.</p>
    </div>
  );
};
