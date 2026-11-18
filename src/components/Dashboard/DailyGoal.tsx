import React, { useState } from 'react';
import { Bell, BellOff, Flame, Settings2, Target } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Section } from '../UI/kit';

const GOALS = [5, 10, 15, 30, 45, 60];
const DAY = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' });

/** Objectif quotidien : anneau du jour, 7 derniers jours, réglage de l'objectif et du rappel. */
export const DailyGoal: React.FC = () => {
  const { data, setData } = useApi(() => api.get('/analytics/daily-goal/'), []);
  const [editing, setEditing] = useState(false);
  if (!data) return null;

  const update = async (patch: Record<string, unknown>) => setData(await api.patch('/analytics/daily-goal/', patch));
  const pct = Math.min(100, (data.today_minutes / data.daily_goal_minutes) * 100);
  const r = 34;
  const c = 2 * Math.PI * r;
  const maxDay = Math.max(data.daily_goal_minutes, ...data.last_7_days.map((d: { minutes: number }) => d.minutes));

  return (
    <Section title="Objectif du jour" actions={
      <button onClick={() => setEditing(!editing)} aria-label="Régler l'objectif" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Settings2 className="w-4 h-4" /></button>
    }>
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg width="80" height="80" className="-rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-gray-100" />
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
              className={data.reached ? 'stroke-secondary-500' : 'stroke-sun-500'} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            {data.reached ? <Target className="w-6 h-6 text-secondary-600" /> : <><span className="text-lg font-extrabold">{data.today_minutes}</span><span className="text-[10px] text-gray-500">/ {data.daily_goal_minutes} min</span></>}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{data.reached ? 'Objectif atteint, bravo ! 🎉' : `Encore ${data.daily_goal_minutes - data.today_minutes} min aujourd'hui`}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
            <Flame className="w-4 h-4 text-sun-600" />{data.current_streak} jour(s) d'affilée
          </p>
          <div className="mt-3 flex gap-1.5 h-14 max-w-sm" aria-label="Minutes des 7 derniers jours">
            {data.last_7_days.map((d: { date: string; minutes: number }) => (
              <div key={d.date} className="flex-1 h-full flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end">
                  <div className={`w-full rounded ${d.minutes >= data.daily_goal_minutes ? 'bg-secondary-500' : d.minutes ? 'bg-sun-400' : 'bg-gray-200'}`}
                    style={{ height: `${Math.max(10, (d.minutes / maxDay) * 100)}%` }} title={`${d.minutes} min`} />
                </div>
                <span className="text-[10px] text-gray-400 uppercase">{DAY(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Mon objectif quotidien</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g} onClick={() => update({ daily_goal_minutes: g })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold ring-1 ${data.daily_goal_minutes === g ? 'bg-primary-700 text-white ring-primary-700' : 'ring-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                  {g} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => update({ reminder_enabled: !data.reminder_enabled })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ring-1 ${data.reminder_enabled ? 'ring-secondary-200 bg-secondary-50 text-secondary-700' : 'ring-gray-200 text-gray-500'}`}>
              {data.reminder_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {data.reminder_enabled ? 'Rappel activé' : 'Rappel désactivé'}
            </button>
            {data.reminder_enabled && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                à
                <select value={data.reminder_hour} onChange={(e) => update({ reminder_hour: Number(e.target.value) })}
                  className="rounded-lg ring-1 ring-gray-200 px-2 py-1.5 bg-white">
                  {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
                si l'objectif n'est pas atteint
              </label>
            )}
          </div>
        </div>
      )}
    </Section>
  );
};
