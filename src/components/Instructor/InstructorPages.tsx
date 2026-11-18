import React, { useState } from 'react';
import { Download, DollarSign, Wallet, Clock, Percent } from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { useApi } from '../../hooks/useApi';
import { BarChart, Card, ErrorBox, PageHeader, Spinner, StatCard, buttonSecondary, inputClass } from '../UI';
import { InstructorPayouts } from '../Payment/Payouts';
import { ProgressBar } from '../UI/kit';

export const Students: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.get('/analytics/instructor/students/', { search, page }), [search, page]);

  return (
    <div>
      <PageHeader title="Mes étudiants" subtitle="Progression de vos apprenants" action={
        <button onClick={() => downloadFile('/analytics/export/students/', 'mes-etudiants.csv')} className={`${buttonSecondary} flex items-center space-x-2`}><Download className="w-4 h-4" /><span>Exporter (CSV)</span></button>
      } />
      <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher un étudiant…" className={`${inputClass} mb-4 max-w-md`} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr><th className="p-3">Étudiant</th><th className="p-3">Cours</th><th className="p-3">Progression</th><th className="p-3">Inscription</th><th className="p-3">Dernière activité</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.results.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">Aucun étudiant pour le moment.</td></tr>}
              {data.results.map((r: any) => (
                <tr key={r.id}>
                  <td className="p-3"><p className="font-medium text-gray-900">{r.student}</p><p className="text-gray-500">{r.email}</p></td>
                  <td className="p-3">{r.course}</td>
                  <td className="p-3 w-48">
                    <div className="flex items-center space-x-2">
                      <ProgressBar value={r.progress} tone={r.status === 'COMPLETED' ? 'secondary' : 'primary'} className="flex-1" />
                      <span>{Math.round(r.progress)} %</span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-500">{new Date(r.enrolled_at).toLocaleDateString('fr-FR')}</td>
                  <td className="p-3 text-gray-500">{new Date(r.last_accessed).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.num_pages > 1 && (
            <div className="flex justify-center items-center space-x-4 p-3 border-t text-sm">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Précédent</button>
              <span>{page} / {data.num_pages}</span>
              <button disabled={page >= data.num_pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Suivant →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InstructorAnalytics: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => {
    const [earnings, dash] = await Promise.all([api.get('/payments/earnings/'), api.get('/analytics/instructor/')]);
    return { earnings, dash };
  }, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
  const e = data.earnings;

  return (
    <div className="space-y-6">
      <PageHeader title="Revenus & statistiques" action={
        <button onClick={() => downloadFile('/analytics/export/sales/', 'mes-ventes.csv')} className={`${buttonSecondary} flex items-center space-x-2`}><Download className="w-4 h-4" /><span>Exporter mes ventes</span></button>
      } />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Revenus nets cumulés" value={formatMoney(Number(e.net_total))} icon={DollarSign} color="bg-secondary-100 text-secondary-600" />
        <StatCard label="Ce mois-ci" value={formatMoney(Number(e.this_month))} icon={Clock} />
        <StatCard label="À verser" value={formatMoney(Number(e.pending_payout))} hint={`Déjà versé : ${formatMoney(Number(e.paid_out))}`} icon={Wallet} color="bg-sun-100 text-sun-600" />
        <StatCard label="Commission plateforme" value={`${e.commission_rate} %`} icon={Percent} color="bg-secondary-100 text-secondary-600" />
      </div>
      <InstructorPayouts />
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Revenus nets (30 jours)</h2>
        <BarChart data={data.dash.revenue_30_days.map((d: any) => ({ label: d.date, value: d.value }))} format={(v) => formatMoney(v)} />
      </Card>
      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Dernières ventes</h2>
        {e.recent.length === 0 ? <p className="text-sm text-gray-500">Aucune vente pour le moment.</p> : (
          <div className="divide-y text-sm">
            {e.recent.map((c: any) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div><p className="font-medium text-gray-900">{c.course?.title || 'Vente'}</p><p className="text-gray-500">{c.student} · {new Date(c.created_at).toLocaleDateString('fr-FR')}</p></div>
                <div className="text-right"><p className="font-semibold">{formatMoney(Number(c.instructor_amount))}</p><p className="text-xs text-gray-500">{c.is_paid ? 'versé' : 'à verser'}</p></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
