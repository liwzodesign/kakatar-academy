import React, { useState } from 'react';
import { CheckCircle2, Clock, Download, Link2, RotateCcw, Send } from 'lucide-react';
import { api, downloadFile, request } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { ErrorBox, Spinner, inputClass } from '../UI';
import { Badge, Field, FileDrop } from '../UI/kit';

export interface SubmissionData {
  id: string;
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

const STATUS_UI = {
  SUBMITTED: { tone: 'sun' as const, icon: Clock, text: 'Votre travail a été rendu. Le formateur va le corriger.' },
  NEEDS_REVISION: { tone: 'rose' as const, icon: RotateCcw, text: 'Le formateur demande quelques modifications.' },
  APPROVED: { tone: 'secondary' as const, icon: CheckCircle2, text: 'Travail validé : la leçon est terminée.' },
};

/** Rendu d'un devoir / projet par l'étudiant, avec retour du formateur. */
export const AssignmentPanel: React.FC<{ lessonId: string; onApproved?: () => void }> = ({ lessonId }) => {
  const { data: submission, loading, error, setData } = useApi<SubmissionData | null>(
    () => api.get(`/assignments/lessons/${lessonId}/submission/`), [lessonId]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  if (loading) return <Spinner className="h-32" />;
  if (error) return <ErrorBox message={error} />;

  const startEdit = () => {
    setText(submission?.text || '');
    setLink(submission?.link || '');
    setFile(null);
    setEditing(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const body = new FormData();
    body.append('text', text);
    body.append('link', link);
    if (file) body.append('file', file);
    try {
      setData(await request(`/assignments/lessons/${lessonId}/submission/`, { method: 'POST', body }));
      setEditing(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showForm = editing || !submission;
  const ui = submission ? STATUS_UI[submission.status] : null;

  return (
    <div className="space-y-4">
      {submission && ui && (
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={ui.tone} icon={ui.icon}>{submission.status_display}</Badge>
            {submission.grade !== null && <span className="text-2xl font-extrabold text-primary-800">{submission.grade}<span className="text-sm text-gray-400">/100</span></span>}
            <span className="text-xs text-gray-400 ml-auto">Version {submission.attempts} · {new Date(submission.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <p className="text-gray-700">{ui.text}</p>
          {submission.feedback && (
            <blockquote className="border-l-4 border-primary-300 bg-primary-50/50 rounded-r-xl p-4 text-gray-800 whitespace-pre-line">
              <span className="block text-xs font-bold text-primary-700 mb-1">Commentaire du formateur</span>
              {submission.feedback}
            </blockquote>
          )}
          {!editing && (
            <div className="text-sm space-y-2 border-t border-gray-100 pt-4">
              <p className="font-semibold text-gray-900">Votre rendu</p>
              {submission.text && <p className="text-gray-700 whitespace-pre-line">{submission.text}</p>}
              {submission.link && <a href={submission.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary-700 hover:underline"><Link2 className="w-4 h-4" />{submission.link}</a>}
              {submission.has_file && (
                <button onClick={() => downloadFile(`/assignments/submissions/${submission.id}/file/`, submission.file_name)} className="flex items-center gap-1.5 text-primary-700 font-semibold hover:underline">
                  <Download className="w-4 h-4" />{submission.file_name}
                </button>
              )}
              {submission.status !== 'APPROVED' && (
                <button onClick={startEdit} className="mt-2 px-4 py-2 rounded-xl ring-1 ring-gray-200 font-semibold hover:bg-gray-50">
                  {submission.status === 'NEEDS_REVISION' ? 'Envoyer une nouvelle version' : 'Modifier mon rendu'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Rendre mon travail</h3>
            <p className="text-sm text-gray-500">Répondez directement, ajoutez un lien (GitHub, Figma, Drive…) ou un fichier.</p>
          </div>
          <Field label="Votre réponse">
            <textarea className={inputClass} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Expliquez votre démarche, vos choix…" />
          </Field>
          <Field label="Lien" hint="Facultatif">
            <input className={inputClass} type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Fichier" hint={submission?.has_file && !file ? `Fichier actuel : ${submission.file_name} (conservé si vous n'en choisissez pas d'autre). 25 Mo max.` : '25 Mo maximum.'}>
            <FileDrop file={file} onChange={setFile} label="Choisir un fichier" />
          </Field>
          {formError && <ErrorBox message={formError} />}
          <div className="flex justify-end gap-2">
            {submission && <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>}
            <button disabled={busy || (!text.trim() && !link.trim() && !file && !submission?.has_file)}
              className="flex items-center gap-2 bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-primary-800">
              <Send className="w-4 h-4" />{busy ? 'Envoi…' : 'Rendre le travail'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
