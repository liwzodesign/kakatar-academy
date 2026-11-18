import React from 'react';
import { Users, BookOpen, DollarSign, TrendingUp, ShieldCheck, Wallet, AlertTriangle, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { mapCourse } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { BarChart, ErrorBox, Spinner, StatCard } from '../UI';

export const AdminDashboard: React.FC = () => {
  const { data, loading, error, reload } = useApi(() => api.get('/analytics/admin/'), []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
  const s = data.stats;

  const pending = [
    { title: 'Vérifications formateurs', count: s.pending_verifications, icon: ShieldCheck, path: '/moderation', color: 'text-sun-600 bg-sun-50' },
    { title: 'Versements formateurs à effectuer', count: formatMoney(s.pending_payouts), icon: Wallet, path: '/payments?tab=payouts', color: 'text-primary-600 bg-primary-50' },
    { title: 'Paiements échoués (7 j)', count: s.failed_payments_7d, icon: AlertTriangle, path: '/payments', color: 'text-red-600 bg-red-50' },
    { title: 'Sessions à venir', count: s.upcoming_sessions, icon: Calendar, path: '/sessions', color: 'text-secondary-600 bg-secondary-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-600">Vue d'ensemble de la plateforme</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Utilisateurs" value={s.total_users} hint={`+${s.new_users_this_month} ce mois · ${s.active_users_7d} actifs (7 j)`} icon={Users} />
        <StatCard label="Cours publiés" value={s.published_courses} hint={`${s.total_enrollments} inscriptions`} icon={BookOpen} color="bg-secondary-100 text-secondary-600" />
        <StatCard label="Chiffre d'affaires" value={formatMoney(s.revenue_total)} hint={`${formatMoney(s.revenue_this_month)} ce mois`} icon={DollarSign} color="bg-sun-100 text-sun-600" />
        <StatCard label="Commission plateforme" value={formatMoney(s.platform_commission)} hint={`Complétion moyenne ${Math.round(s.completion_rate)} %`} icon={TrendingUp} color="bg-secondary-100 text-secondary-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">À traiter</h2>
          <div className="space-y-3">
            {pending.map((p) => (
              <button key={p.title} onClick={() => navigate(p.path)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-left">
                <span className="flex items-center space-x-3">
                  <span className={`p-2 rounded-lg ${p.color}`}><p.icon className="w-5 h-5" /></span>
                  <span className="font-medium text-gray-900">{p.title}</span>
                </span>
                <span className="font-bold text-gray-900">{p.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Inscriptions d'utilisateurs (30 jours)</h2>
          <BarChart data={data.signups_30_days.map((d: any) => ({ label: d.date, value: d.value }))} />
          <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
            {Object.entries(s.users_by_role).map(([role, count]) => (
              <span key={role} className="bg-gray-100 px-2 py-1 rounded">{role.toLowerCase()} : {String(count)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Cours les plus populaires</h2>
        <div className="divide-y divide-gray-100">
          {data.top_courses.map(mapCourse).map((c: any) => (
            <button key={c.id} onClick={() => navigate(`/courses/${c.slug}`)} className="w-full flex items-center space-x-4 py-3 text-left hover:bg-gray-50">
              <img src={c.thumbnail} alt="" className="w-16 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{c.title}</p>
                <p className="text-sm text-gray-500">{c.instructor.name} · {c.studentsCount} étudiants · ★ {c.rating.toFixed(1)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
