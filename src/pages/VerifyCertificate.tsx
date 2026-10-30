import { useParams } from 'react-router-dom';
import { BadgeCheck, XCircle } from 'lucide-react';
import { Spinner } from '../components/ui';
import { useApi } from '../lib/useApi';

interface Result { valid: boolean; code: string; student: string; course: string; issued_at: string }

export default function VerifyCertificate() {
  const { code } = useParams();
  const { data, error, loading } = useApi<Result>(`/courses/certificates/verify/${encodeURIComponent(code || '')}/`);
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {loading && <Spinner label="Vérification…" />}
      {data?.valid && (
        <div className="rounded-2xl border border-green-200 bg-white p-8">
          <BadgeCheck className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold">Certificat authentique</h1>
          <p className="mt-4 text-gray-700"><strong>{data.student}</strong> a terminé la formation</p>
          <p className="mt-1 font-semibold text-brand-700">{data.course}</p>
          <p className="mt-4 text-sm text-gray-500">
            Délivré le {new Date(data.issued_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })} · Code {data.code}
          </p>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-white p-8">
          <XCircle className="mx-auto h-12 w-12 text-red-600" />
          <h1 className="mt-4 text-xl font-bold">Certificat introuvable</h1>
          <p className="mt-2 text-gray-600">Le code « {code} » ne correspond à aucun certificat délivré par Kakatar Academy.</p>
        </div>
      )}
    </div>
  );
}
