import { Link } from 'react-router-dom';
import { Award, Download } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { downloadFile } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { Enrollment } from '../types';

export default function MyLearning() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<Enrollment[]>('/courses/enrollments/');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Bonjour {user?.first_name} 👋</h1>
      <p className="mt-1 text-gray-600">Reprenez vos formations là où vous les avez laissées.</p>

      <div className="mt-8">
        {loading && <Spinner />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && data.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">Vous n'êtes inscrit à aucune formation pour l'instant.</p>
            <Link to="/" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">
              Découvrir les formations
            </Link>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((e) => {
            const progress = Number(e.progress);
            return (
              <div key={e.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs text-gray-500">{e.course.instructor}</p>
                <h2 className="mt-1 font-semibold text-gray-900">{e.course.title}</h2>
                <div className="mt-4"><ProgressBar value={progress} /></div>
                <p className="mt-1 text-sm text-gray-600">{Math.round(progress)} % · {e.course.lessons_count} leçons</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/apprendre/${e.course.slug}`}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    {progress >= 100 ? 'Revoir' : progress > 0 ? 'Continuer' : 'Commencer'}
                  </Link>
                  {e.certificate_issued && (
                    <button
                      onClick={() => downloadFile(`/courses/${e.course.slug}/certificate/`, `certificat-${e.course.slug}.pdf`)}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
                      <Download className="h-4 w-4" /> Certificat
                    </button>
                  )}
                </div>
                {e.certificate_issued && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-green-700"><Award className="h-3.5 w-3.5" /> Code : {e.certificate_code}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
