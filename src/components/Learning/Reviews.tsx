import React, { useState } from 'react';
import { Brain, CheckCircle2, XCircle, ArrowRight, Sparkles, CalendarClock } from 'lucide-react';
import { api } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorBox, PageHeader, Spinner, buttonPrimary } from '../UI';
import { ProgressBar, Section } from '../UI/kit';

interface Card {
  id: number;
  question: string;
  options: string[];
  box: number;
  lesson: { id: string; title: string };
  course: { slug: string; title: string };
}

interface ReviewData {
  due_count: number;
  total: number;
  mastered: number;
  next_due: string | null;
  cards: Card[];
  boxes: number[];
}

interface Feedback {
  correct: boolean;
  answer: number;
  explanation: string;
  box: number;
  mastered: boolean;
  next_due: string;
}

const LETTERS = 'ABCDEFGH';
const BOX_LABELS = ['Demain', '3 jours', '1 semaine', '16 jours', '5 semaines'];
const inDays = (iso: string) => {
  const days = Math.round((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 86400000);
  return days <= 1 ? 'demain' : `dans ${days} jours`;
};

/** Les 5 boîtes de Leitner : où en est la mémorisation. */
const Boxes: React.FC<{ boxes: number[]; mastered: number }> = ({ boxes, mastered }) => (
  <div className="grid grid-cols-6 gap-2">
    {boxes.map((n, i) => (
      <div key={i} className="rounded-xl bg-gray-50 ring-1 ring-gray-100 p-2.5 text-center">
        <p className="text-lg font-extrabold text-gray-900 tabular-nums">{n}</p>
        <p className="text-[10px] text-gray-500 leading-tight">Boîte {i + 1}<span className="hidden sm:inline"> · {BOX_LABELS[i]}</span></p>
      </div>
    ))}
    <div className="rounded-xl bg-secondary-50 ring-1 ring-secondary-100 p-2.5 text-center">
      <p className="text-lg font-extrabold text-secondary-700 tabular-nums">{mastered}</p>
      <p className="text-[10px] text-secondary-700 leading-tight">Maîtrisées</p>
    </div>
  </div>
);

/** Session de révision : une question à la fois, correction immédiate. */
const Session: React.FC<{ cards: Card[]; onDone: (score: number) => void }> = ({ cards, onDone }) => {
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const card = cards[i];

  const answer = async (c: number) => {
    if (feedback) return;
    setChoice(c);
    setError('');
    try {
      const res = await api.post<Feedback>(`/analytics/reviews/${card.id}/answer/`, { choice: c });
      setFeedback(res);
      if (res.correct) setScore((s) => s + 1);
    } catch (err) {
      setError((err as Error).message);
      setChoice(null);
    }
  };

  const next = () => {
    if (i + 1 >= cards.length) return onDone(score);
    setI(i + 1);
    setChoice(null);
    setFeedback(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <ProgressBar value={(i / cards.length) * 100} className="flex-1" />
        <span className="text-sm font-semibold text-gray-500 tabular-nums">{i + 1} / {cards.length}</span>
      </div>
      <Section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{card.course.title} · {card.lesson.title}</p>
        <h2 className="text-xl font-bold text-gray-900 mt-2 mb-5">{card.question}</h2>
        <div className="space-y-3">
          {card.options.map((opt, k) => {
            const isAnswer = feedback && k === feedback.answer;
            const isWrongPick = feedback && k === choice && !feedback.correct;
            return (
              <button key={k} onClick={() => answer(k)} disabled={!!feedback}
                className={`w-full flex items-center gap-3 text-left rounded-xl ring-1 px-4 py-3.5 transition-colors ${
                  isAnswer ? 'ring-secondary-400 bg-secondary-50' : isWrongPick ? 'ring-red-300 bg-red-50' : choice === k ? 'ring-primary-400 bg-primary-50' : 'ring-gray-200 hover:bg-gray-50'}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isAnswer ? 'bg-secondary-500 text-white' : isWrongPick ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{LETTERS[k]}</span>
                <span className="flex-1 text-gray-800">{opt}</span>
                {isAnswer && <CheckCircle2 className="w-5 h-5 text-secondary-600" />}
                {isWrongPick && <XCircle className="w-5 h-5 text-red-500" />}
              </button>
            );
          })}
        </div>
        {error && <div className="mt-4"><ErrorBox message={error} /></div>}
        {feedback && (
          <div className={`mt-5 rounded-xl p-4 ${feedback.correct ? 'bg-secondary-50 text-secondary-800' : 'bg-sun-50 text-sun-800'}`}>
            <p className="font-bold">
              {feedback.mastered ? 'Question maîtrisée ! Elle sort de vos révisions. 🎉'
                : feedback.correct ? `Bien joué ! Prochaine révision ${inDays(feedback.next_due)}.`
                  : 'Pas encore — elle reviendra demain.'}
            </p>
            {feedback.explanation && <p className="text-sm mt-1 opacity-90">{feedback.explanation}</p>}
          </div>
        )}
      </Section>
      {feedback && (
        <div className="flex justify-end">
          <button onClick={next} className={`${buttonPrimary} flex items-center gap-2`} autoFocus>
            {i + 1 >= cards.length ? 'Terminer' : 'Question suivante'}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const Reviews: React.FC = () => {
  const { data, loading, error, reload } = useApi(() => api.get<ReviewData>('/analytics/reviews/'), []);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  if (running && data.cards.length) {
    return <Session cards={data.cards} onDone={(score) => { setResult({ score, total: data.cards.length }); setRunning(false); reload(); }} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Révisions" subtitle="Les questions que vous avez ratées reviennent juste avant que vous les oubliiez. 5 minutes par jour suffisent." />

      {result && (
        <div className="rounded-2xl bg-gradient-to-r from-secondary-500 to-secondary-600 text-white p-5 flex items-center gap-4">
          <Sparkles className="w-8 h-8" />
          <div>
            <p className="font-bold text-lg">Session terminée : {result.score} / {result.total} bonnes réponses</p>
            <p className="text-white/85 text-sm">Chaque bonne réponse espace la prochaine révision.</p>
          </div>
        </div>
      )}

      <Section>
        <div className="flex flex-wrap items-center gap-5">
          <span className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center"><Brain className="w-7 h-7" /></span>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-2xl font-extrabold text-gray-900">{data.due_count} question{data.due_count > 1 ? 's' : ''} à revoir aujourd'hui</p>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <CalendarClock className="w-4 h-4" />
              {data.due_count ? 'Environ ' + Math.max(1, Math.ceil(Math.min(data.due_count, 20) * 0.3)) + ' min' : data.next_due ? `Prochaine révision ${inDays(data.next_due)}` : 'Rien de prévu pour le moment'}
            </p>
          </div>
          {data.cards.length > 0 && <button onClick={() => { setResult(null); setRunning(true); }} className={buttonPrimary}>Commencer la révision</button>}
        </div>
      </Section>

      {data.total > 0 ? (
        <Section title="Votre mémoire" description="Une bonne réponse fait passer la question dans la boîte suivante ; une erreur la ramène en boîte 1.">
          <Boxes boxes={data.boxes} mastered={data.mastered} />
        </Section>
      ) : (
        <EmptyState title="Pas encore de révisions" text="Faites les quiz de vos cours : chaque question ratée est ajoutée ici automatiquement."
          action={<button onClick={() => navigate('/my-courses')} className={buttonPrimary}>Mes cours</button>} />
      )}
    </div>
  );
};
