import React from 'react';
import { Trophy, Crown, Brain, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { Section } from '../UI/kit';

interface LeaderboardData {
  week_start: string;
  week_end: string;
  top: { rank: number; name: string; minutes: number; is_me: boolean; handle: string | null }[];
  me: { rank: number | null; minutes: number; participants: number };
}

const MEDALS = ['bg-sun-400 text-white', 'bg-gray-300 text-gray-800', 'bg-amber-600 text-white'];
const short = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Ligue de la semaine : classement par minutes d'apprentissage, remis à zéro chaque lundi. */
export const League: React.FC = () => {
  const { data } = useApi(() => api.get<LeaderboardData>('/analytics/leaderboard/'), []);
  if (!data) return null;
  const meInTop = data.top.some((r) => r.is_me);

  return (
    <Section title={<span className="flex items-center gap-2"><Trophy className="w-5 h-5 text-sun-500" />Ligue de la semaine</span>}
      description={`Du ${short(data.week_start)} au ${short(data.week_end)} · remise à zéro chaque lundi`} padded={false}>
      {data.top.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-500">Personne n'a encore appris cette semaine. Terminez une leçon pour prendre la tête !</p>
      ) : (
        <ol className="pb-2">
          {data.top.slice(0, 10).map((r) => (
            <li key={r.rank} className={`flex items-center gap-3 px-5 sm:px-6 py-2.5 ${r.is_me ? 'bg-primary-50' : ''}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${MEDALS[r.rank - 1] || 'bg-gray-100 text-gray-500'}`}>
                {r.rank === 1 ? <Crown className="w-3.5 h-3.5" /> : r.rank}
              </span>
              {r.handle ? (
                <button onClick={() => navigate(`/u/${r.handle}`)} className="flex-1 text-left font-semibold text-gray-900 hover:text-primary-700 truncate">{r.name}</button>
              ) : <span className="flex-1 font-semibold text-gray-900 truncate">{r.name}{r.is_me && ' (vous)'}</span>}
              <span className="text-sm font-bold tabular-nums text-gray-700">{r.minutes} min</span>
            </li>
          ))}
        </ol>
      )}
      {!meInTop && data.top.length > 0 && (
        <p className="px-5 sm:px-6 py-3 border-t border-gray-100 text-sm text-gray-600">
          {data.me.rank ? `Vous êtes ${data.me.rank}ᵉ sur ${data.me.participants} avec ${data.me.minutes} min.` : 'Vous n’êtes pas encore classé cette semaine.'}
        </p>
      )}
    </Section>
  );
};

/** Bandeau « révisions du jour » pour le tableau de bord. */
export const ReviewsBanner: React.FC = () => {
  const { data } = useApi(() => api.get<{ due_count: number }>('/analytics/reviews/'), []);
  if (!data?.due_count) return null;
  return (
    <button onClick={() => navigate('/reviews')} className="w-full flex items-center gap-4 rounded-2xl bg-white ring-1 ring-primary-100 shadow-card p-4 sm:p-5 text-left hover:ring-primary-300 transition">
      <span className="w-12 h-12 rounded-xl bg-primary-700 text-white flex items-center justify-center"><Brain className="w-6 h-6" /></span>
      <span className="flex-1">
        <span className="block font-bold text-gray-900">{data.due_count} question{data.due_count > 1 ? 's' : ''} à réviser aujourd'hui</span>
        <span className="block text-sm text-gray-500">Quelques minutes pour ne pas oublier ce que vous avez appris.</span>
      </span>
      <ArrowRight className="w-5 h-5 text-primary-700" />
    </button>
  );
};
