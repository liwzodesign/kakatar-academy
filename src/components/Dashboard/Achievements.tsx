import React, { useState } from 'react';
import { Award, BookOpen, Flame, Hammer, Lock, Medal, MessageSquare, Play, Rocket, Star, Target, Trophy } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Section } from '../UI/kit';

const ICONS: Record<string, React.ElementType> = {
  rocket: Rocket, play: Play, book: BookOpen, medal: Medal, target: Target, flame: Flame, message: MessageSquare,
  hammer: Hammer, award: Award, trophy: Trophy, star: Star,
};
const TINTS = ['bg-primary-100 text-primary-700', 'bg-secondary-100 text-secondary-700', 'bg-sun-100 text-sun-700',
  'bg-sky-100 text-sky-600', 'bg-rose-100 text-rose-600'];

interface Badge { key: string; title: string; description: string; icon: string; unlocked: boolean; progress: number; goal: number }

export const Achievements: React.FC = () => {
  const { data } = useApi(() => api.get('/analytics/achievements/'), []);
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;

  const span = data.next_level_xp ? data.next_level_xp - data.level_floor : 1;
  const pct = data.next_level_xp ? ((data.xp - data.level_floor) / span) * 100 : 100;
  const badges: Badge[] = [...data.badges].sort((a: Badge, b: Badge) => Number(b.unlocked) - Number(a.unlocked));
  const shown = showAll ? badges : badges.slice(0, 6);

  return (
    <Section title="Mes progrès" description={`${data.unlocked_count} badge(s) sur ${data.badges.length}`}
      actions={<button onClick={() => setShowAll(!showAll)} className="text-sm font-semibold text-primary-700">{showAll ? 'Réduire' : 'Tous les badges'}</button>}>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <span className="w-14 h-14 rounded-2xl bg-brand-gradient text-white flex flex-col items-center justify-center leading-none">
          <span className="text-[10px] font-semibold uppercase opacity-80">Niv.</span>
          <span className="text-xl font-extrabold">{data.level}</span>
        </span>
        <div className="flex-1 min-w-[12rem]">
          <div className="flex justify-between text-sm">
            <span className="font-bold text-gray-900">{data.level_name}</span>
            <span className="text-gray-500 tabular-nums">{data.xp} XP{data.next_level_xp ? ` / ${data.next_level_xp}` : ''}</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers le niveau suivant">
            <div className="h-full rounded-full bg-gradient-to-r from-sun-400 to-sun-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Leçon : +10 XP · Quiz réussi : +20 · Devoir validé : +50 · Certificat : +100</p>
        </div>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {shown.map((b, i) => {
          const Icon = ICONS[b.icon] || Award;
          return (
            <li key={b.key} title={b.description}
              className={`rounded-2xl p-4 text-center ring-1 transition-all ${b.unlocked ? 'ring-gray-100 bg-white' : 'ring-gray-100 bg-gray-50'}`}>
              <span className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${b.unlocked ? TINTS[i % TINTS.length] : 'bg-gray-200 text-gray-400'}`}>
                {b.unlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
              </span>
              <p className={`mt-2.5 text-sm font-bold leading-tight ${b.unlocked ? 'text-gray-900' : 'text-gray-500'}`}>{b.title}</p>
              <p className="mt-1 text-[11px] text-gray-500 leading-snug">{b.unlocked ? b.description : `${b.progress}/${b.goal} · ${b.description}`}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
