import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink } from 'lucide-react';
import { ErrorBox, Spinner } from '../components/ui';
import { API_URL } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { CourseSummary } from '../types';

interface Analytics {
  total_enrollments: number; completed_enrollments: number; avg_progress: number;
  completion_rate: number; total_revenue: string; currency: string;
}

function Stats({ slug }: { slug: string }) {
  const { data, loading, error } = useApi<Analytics>(`/courses/${slug}/analytics/`);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const items = [
    ['Inscrits', data.total_enrollments],
    ['Terminés', `${data.completed_enrollments} (${data.completion_rate} %)`],
    ['Progression moyenne', `${Math.round(Number(data.avg_progress))} %`],
    ['Ventes encaissées', formatPrice(data.total_revenue, data.currency)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k as string} className="rounded-lg bg-gray-50 p-3">
          <dt className="text-xs text-gray-500">{k}</dt>
          <dd className="mt-1 font-semibold text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATUS: Record<string, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', SCHEDULED: 'Programmé' };

export default function Teach() {
  const { data, error, loading } = useApi<(CourseSummary & { status?: string })[]>('/courses/mine/');
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Espace formateur</h1>
          <p className="mt-1 text-gray-600">Vos formations et leurs résultats.</p>
        </div>
        <a href={`${API_URL}/admin/courses/course/`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Gérer le contenu <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-8 space-y-4">
        {loading && <Spinner />}
        {error && <ErrorBox error={error} />}
        {data?.length === 0 && <p className="text-gray-600">Aucune formation pour l'instant.</p>}
        {data?.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/formations/${c.slug}`} className="font-semibold text-gray-900 hover:text-brand-700">{c.title}</Link>
                <p className="text-sm text-gray-500">
                  {c.lessons_count} leçons · {formatPrice(c.price, c.currency)} · {STATUS[c.status || 'PUBLISHED'] || c.status}
                </p>
              </div>
              <button onClick={() => setOpen(open === c.slug ? null : c.slug)}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                <BarChart3 className="h-4 w-4" /> Statistiques
              </button>
            </div>
            {open === c.slug && <div className="mt-4"><Stats slug={c.slug} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
