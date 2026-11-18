import React, { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorBox, Modal, Spinner, SuccessBox, inputClass } from '../UI';
import { Field } from '../UI/kit';

interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
  recipients_count: number | null;
}

/** Liste des annonces d'un cours (lecteur, côté étudiant). */
export const CourseAnnouncements: React.FC<{ slug: string }> = ({ slug }) => {
  const { data, loading, error } = useApi<Announcement[]>(() => api.get(`/community/courses/${slug}/announcements/`), [slug]);
  if (loading) return <Spinner className="h-32" />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.length) return <EmptyState title="Aucune annonce" text="Les messages du formateur à la classe apparaîtront ici." />;
  return (
    <div className="space-y-4">
      {data.map((a) => (
        <article key={a.id} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-sun-100 text-sun-700 flex items-center justify-center"><Megaphone className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900">{a.title}</h3>
              <p className="text-xs text-gray-500">{a.author} · {new Date(a.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
            </div>
          </div>
          <p className="mt-4 text-gray-700 whitespace-pre-line leading-relaxed">{a.body}</p>
        </article>
      ))}
    </div>
  );
};

/** Fenêtre de rédaction d'une annonce (formateur). */
export const AnnouncementComposer: React.FC<{ slug: string; courseTitle: string; onClose: () => void }> = ({ slug, courseTitle, onClose }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/community/courses/${slug}/announcements/`, { title, body });
      setSent(res.recipients_count);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nouvelle annonce" onClose={onClose}>
      {sent !== null ? (
        <div className="space-y-4">
          <SuccessBox message={`Annonce envoyée à ${sent} inscrit(s) : notification dans l'application et email (selon leurs préférences).`} />
          <button onClick={onClose} className="w-full bg-primary-700 text-white py-2.5 rounded-xl font-semibold">Fermer</button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-gray-500">Pour tous les inscrits de « {courseTitle} ».</p>
          <Field label="Titre" required><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ex. : Session de révision jeudi" /></Field>
          <Field label="Message" required hint={`${body.length}/5000`}>
            <textarea className={inputClass} rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
          </Field>
          {error && <ErrorBox message={error} />}
          <button disabled={busy || title.trim().length < 3 || body.trim().length < 10}
            className="w-full flex items-center justify-center gap-2 bg-primary-700 text-white py-3 rounded-xl font-semibold disabled:opacity-40">
            <Send className="w-4 h-4" />{busy ? 'Envoi…' : 'Envoyer à la classe'}
          </button>
        </form>
      )}
    </Modal>
  );
};
