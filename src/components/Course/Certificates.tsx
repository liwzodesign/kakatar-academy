import React from 'react';
import { Award, CheckCircle, Copy, Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorBox, PageHeader, Spinner, buttonPrimary } from '../UI';

interface Cert {
  id: string;
  code: string;
  issued_at: string;
  student: string;
  course_title: string;
  course_slug: string;
  instructor: string;
  duration: number;
}

const verifyUrl = (code: string) => `${window.location.origin}/certificates/verify/${code}`;

export const Certificates: React.FC = () => {
  const { data, loading, error, reload } = useApi<Cert[]>(() => api.get('/courses/certificates/'), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Mes certificats" subtitle="Chaque certificat est vérifiable publiquement grâce à son code." />
      {!data?.length ? (
        <EmptyState title="Pas encore de certificat" text="Terminez un cours pour obtenir votre premier certificat." action={<button className={buttonPrimary} onClick={() => navigate('/my-courses')}>Mes cours</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6 space-y-3">
              <div className="flex items-center space-x-3">
                <Award className="w-10 h-10 text-sun-500" />
                <div>
                  <h3 className="font-semibold text-gray-900">{c.course_title}</h3>
                  <p className="text-sm text-gray-500">Délivré le {new Date(c.issued_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Code : <span className="font-mono font-semibold">{c.code}</span></p>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/certificates/verify/${c.code}`)} className={buttonPrimary}>Afficher</button>
                <button onClick={() => navigator.clipboard.writeText(verifyUrl(c.code))} className="px-3 py-2 border rounded-lg flex items-center space-x-1 text-sm">
                  <Copy className="w-4 h-4" /><span>Copier le lien</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Page publique : affichage imprimable et vérification d'un certificat. */
export const CertificateVerify: React.FC<{ code: string }> = ({ code }) => {
  const { data, loading, error } = useApi<Cert>(() => api.get(`/courses/certificates/verify/${code}/`), [code]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message="Certificat introuvable : ce code ne correspond à aucun certificat délivré." />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <span className="flex items-center space-x-2 text-secondary-700 font-medium"><CheckCircle className="w-5 h-5" /><span>Certificat authentique</span></span>
        <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 border rounded-lg bg-white"><Printer className="w-4 h-4" /><span>Imprimer / PDF</span></button>
      </div>
      <div className="bg-white border-8 border-double border-primary-700 rounded-xl p-10 text-center space-y-6">
        <p className="text-sm tracking-widest text-primary-700 font-semibold">KAKATAR ACADEMY</p>
        <h1 className="text-4xl font-serif text-gray-900">Certificat de réussite</h1>
        <p className="text-gray-600">Ce certificat atteste que</p>
        <p className="text-3xl font-bold text-gray-900">{data.student}</p>
        <p className="text-gray-600">a suivi avec succès la formation</p>
        <p className="text-2xl font-semibold text-primary-700">{data.course_title}</p>
        <p className="text-gray-600">({formatDuration(data.duration)} de contenu) dispensée par {data.instructor}</p>
        <div className="flex justify-between text-sm text-gray-500 pt-6 border-t">
          <span>Délivré le {new Date(data.issued_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</span>
          <span>N° {data.code}</span>
        </div>
        <p className="text-xs text-gray-400">Vérification : {verifyUrl(data.code)}</p>
      </div>
    </div>
  );
};

/** Page publique : saisie d'un code de certificat à vérifier (recruteurs, écoles…). */
export const CertificateLookup: React.FC = () => {
  const [code, setCode] = React.useState('');
  return (
    <div className="max-w-lg mx-auto text-center py-10">
      <Award className="w-14 h-14 text-sun-500 mx-auto" />
      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Vérifier un certificat</h1>
      <p className="mt-2 text-gray-600">Saisissez le code figurant sur le certificat pour confirmer son authenticité.</p>
      <form
        onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/certificates/verify/${code.trim().toUpperCase()}`); }}
        className="mt-6 flex gap-2"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code du certificat" placeholder="Ex. : 3FA9C21B7E04"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-mono uppercase focus:ring-4 focus:ring-primary-100 focus:border-primary-300 outline-none" />
        <button className={`${buttonPrimary} px-6 rounded-xl`}>Vérifier</button>
      </form>
    </div>
  );
};
