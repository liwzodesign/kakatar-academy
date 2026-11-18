import React, { useState } from 'react';
import { CheckCircle, Heart, MessageSquare, Trash2, GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Avatar, ErrorBox, Spinner, SuccessBox } from '../UI';

interface Comment {
  id: string;
  body: string;
  author: { id: string; name: string; avatar?: string; is_instructor: boolean };
  is_resolved: boolean;
  likes_count: number;
  liked: boolean;
  can_delete: boolean;
  replies: Comment[];
  created_at: string;
}

const CommentBody: React.FC<{ c: Comment; onLike: () => void; onDelete: () => void }> = ({ c, onLike, onDelete }) => (
  <div className="flex space-x-3">
    <Avatar name={c.author.name} src={c.author.avatar} size="w-8 h-8" />
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-gray-900">{c.author.name}</span>
        {c.author.is_instructor && (
          <span className="flex items-center text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full"><GraduationCap className="w-3 h-3 mr-1" />Formateur</span>
        )}
        <span className="text-gray-400 text-xs">{new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
      </div>
      <p className="text-gray-700 text-sm whitespace-pre-line mt-1">{c.body}</p>
      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
        <button onClick={onLike} className={`flex items-center space-x-1 ${c.liked ? 'text-red-500' : 'hover:text-gray-700'}`}>
          <Heart className={`w-3.5 h-3.5 ${c.liked ? 'fill-current' : ''}`} /><span>{c.likes_count}</span>
        </button>
        {c.can_delete && <button onClick={onDelete} className="flex items-center space-x-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /><span>Supprimer</span></button>}
      </div>
    </div>
  </div>
);

export const LessonDiscussion: React.FC<{ lessonId: string; currentUserId?: string }> = ({ lessonId, currentUserId }) => {
  const { data, loading, error, reload } = useApi<Comment[]>(() => api.get(`/community/lessons/${lessonId}/threads/`), [lessonId]);
  const [question, setQuestion] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const run = async (fn: () => Promise<any>) => {
    setActionError('');
    try {
      const res = await fn();
      if (res?.pending_moderation) setNotice('Votre message sera publié après vérification par la modération.');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    run(() => api.post(`/community/lessons/${lessonId}/threads/`, { body: question })).then(() => setQuestion(''));
  };

  const answer = (threadId: string) => {
    const body = replies[threadId];
    if (!body?.trim()) return;
    run(() => api.post(`/community/threads/${threadId}/replies/`, { body })).then(() => setReplies({ ...replies, [threadId]: '' }));
  };

  const remove = (id: string) => confirm('Supprimer ce message ?') && run(() => api.delete(`/community/comments/${id}/`));

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-5 space-y-5">
      <h3 className="font-semibold text-gray-900 flex items-center space-x-2"><MessageSquare className="w-5 h-5" /><span>Questions & réponses</span></h3>
      <form onSubmit={ask} className="space-y-2">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={5000}
          placeholder="Posez votre question sur cette leçon : le formateur et les autres apprenants pourront répondre."
          className="w-full p-3 border border-gray-300 rounded-lg resize-none" />
        <button disabled={!question.trim()} className="bg-primary-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Publier la question</button>
      </form>
      {notice && <SuccessBox message={notice} />}
      {(error || actionError) && <ErrorBox message={error || actionError} />}
      {loading && !data ? <Spinner className="h-24" /> : !data?.length ? (
        <p className="text-sm text-gray-500">Aucune question pour l'instant. Soyez le premier à en poser une !</p>
      ) : (
        <div className="space-y-5">
          {data.map((t) => (
            <div key={t.id} className={`rounded-lg border p-4 space-y-3 ${t.is_resolved ? 'border-secondary-200 bg-secondary-50/40' : 'border-gray-200'}`}>
              <CommentBody c={t} onLike={() => run(() => api.post(`/community/comments/${t.id}/like/`))} onDelete={() => remove(t.id)} />
              <div className="flex items-center gap-3 text-xs">
                {t.is_resolved && <span className="flex items-center text-secondary-700"><CheckCircle className="w-3.5 h-3.5 mr-1" />Résolue</span>}
                {(t.author.id === currentUserId || t.can_delete) && (
                  <button onClick={() => run(() => api.post(`/community/threads/${t.id}/resolve/`))} className="text-gray-500 underline">
                    {t.is_resolved ? 'Rouvrir' : 'Marquer comme résolue'}
                  </button>
                )}
              </div>
              {t.replies.length > 0 && (
                <div className="ml-6 pl-4 border-l-2 border-gray-100 space-y-3">
                  {t.replies.map((r) => (
                    <CommentBody key={r.id} c={r} onLike={() => run(() => api.post(`/community/comments/${r.id}/like/`))} onDelete={() => remove(r.id)} />
                  ))}
                </div>
              )}
              <div className="ml-6 flex space-x-2">
                <input value={replies[t.id] || ''} onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && answer(t.id)} placeholder="Répondre…"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                <button onClick={() => answer(t.id)} className="text-sm text-primary-600 font-medium">Envoyer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
