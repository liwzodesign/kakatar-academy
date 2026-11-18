import React, { useState } from 'react';
import { Copy, Check, Gift, Users, Share2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { ErrorBox, Spinner } from '../UI';
import { Badge } from '../UI/kit';

const REF_KEY = 'kakatar_referral_code';

/** Mémorise un code de parrainage reçu par lien (?ref=CODE) jusqu'à l'inscription. */
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) localStorage.setItem(REF_KEY, code.toUpperCase());
  } catch {
    /* stockage indisponible */
  }
}

export function storedReferralCode(): string {
  try {
    return localStorage.getItem(REF_KEY) || '';
  } catch {
    return '';
  }
}

export function clearReferralCode() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export const ReferralTab: React.FC = () => {
  const { data, loading, error } = useApi(() => api.get('/auth/referral/'), []);
  const [copied, setCopied] = useState(false);

  if (loading) return <Spinner className="h-40" />;
  if (error || !data) return <ErrorBox message={error} />;

  const message = `Je me forme sur Kakatar Academy : cours d'experts, sessions en direct et certificats. Inscris-toi avec mon lien : ${data.link}`;
  const copy = async () => {
    await navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: 'Kakatar Academy', text: message, url: data.link }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-brand-gradient text-white p-6 sm:p-8">
        <Gift className="w-9 h-9 text-sun-400" />
        <h3 className="mt-3 text-2xl font-extrabold">Invitez vos proches, gagnez -{data.reward_percent} %</h3>
        <p className="mt-2 text-white/80 max-w-xl">
          Pour chaque personne qui s'inscrit avec votre lien et fait son premier achat, vous recevez un code de réduction
          personnel de {data.reward_percent} % sur votre prochain cours.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center bg-white/10 ring-1 ring-white/20 rounded-xl px-4 py-3 font-mono text-sm truncate">{data.link}</div>
          <button onClick={copy} className="flex items-center justify-center gap-2 bg-white text-primary-800 font-bold px-4 py-3 rounded-xl">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copié !' : 'Copier'}
          </button>
          <button onClick={share} className="flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-400 text-white font-bold px-4 py-3 rounded-xl">
            <Share2 className="w-4 h-4" />Partager
          </button>
        </div>
        <p className="mt-3 text-sm text-white/70">Votre code : <span className="font-mono font-bold text-white">{data.code}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl ring-1 ring-gray-100 p-5"><Users className="w-5 h-5 text-primary-600" /><p className="mt-2 text-2xl font-extrabold">{data.referred_count}</p><p className="text-sm text-gray-500">inscrit(s) grâce à vous</p></div>
        <div className="rounded-2xl ring-1 ring-gray-100 p-5"><Gift className="w-5 h-5 text-secondary-600" /><p className="mt-2 text-2xl font-extrabold">{data.converted_count}</p><p className="text-sm text-gray-500">récompense(s) obtenue(s)</p></div>
      </div>

      {data.rewards.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-900 mb-3">Mes codes de récompense</p>
          <ul className="space-y-2">
            {data.rewards.map((r: any) => (
              <li key={r.code} className="flex flex-wrap items-center gap-3 p-3 rounded-xl ring-1 ring-gray-100">
                <span className="font-mono font-bold text-primary-800">{r.code}</span>
                <span className="text-sm font-semibold">{r.discount}</span>
                <span className="text-xs text-gray-500">jusqu'au {new Date(r.valid_until).toLocaleDateString('fr-FR')}</span>
                <span className="ml-auto">{r.used ? <Badge tone="gray">Utilisé</Badge> : r.expired ? <Badge tone="danger">Expiré</Badge> : <Badge tone="secondary">Disponible</Badge>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
