import React, { useEffect, useState } from 'react';
import { Award, BadgeCheck, Copy, ExternalLink, Flame, Globe, Linkedin, Share2, Star } from 'lucide-react';
import { api } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { Avatar, ErrorBox, Spinner, SuccessBox, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, Section } from '../UI/kit';

interface PublicProfileData {
  name: string;
  headline: string;
  bio: string;
  avatar: string | null;
  member_since: string;
  level: number;
  level_name: string;
  xp: number;
  badges: { key: string; title: string; description: string }[];
  skills: string[];
  certificates: { code: string; course: string; course_slug: string; instructor: string; issued_at: string }[];
  longest_streak: number;
}

/** Portfolio public d'un apprenant : à partager avec un recruteur ou sur LinkedIn. */
export const PublicProfile: React.FC<{ handle: string }> = ({ handle }) => {
  const { data: p, loading, error } = useApi(() => api.get<PublicProfileData>(`/analytics/profiles/${handle}/`), [handle]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (p) document.title = `${p.name} — Kakatar Academy`;
  }, [p]);

  if (loading) return <Spinner />;
  if (error || !p) return <ErrorBox message="Ce profil n'existe pas ou n'est pas public." />;

  const url = window.location.href;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: p.name, url }); } catch { /* partage annulé */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary-900 to-primary-700 text-white p-6 sm:p-10 flex flex-col sm:flex-row gap-6 sm:items-center">
        <Avatar name={p.name} src={p.avatar || undefined} size="w-24 h-24 text-3xl ring-4 ring-white/20" />
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-3xl font-extrabold">{p.name}</h1>
          {p.headline && <p className="text-lg text-white/85">{p.headline}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="sun" icon={Star}>Niveau {p.level} · {p.level_name}</Badge>
            {p.certificates.length > 0 && <Badge tone="secondary" icon={Award}>{p.certificates.length} certificat{p.certificates.length > 1 ? 's' : ''}</Badge>}
            {p.longest_streak >= 3 && <Badge tone="rose" icon={Flame}>{p.longest_streak} jours d'affilée</Badge>}
          </div>
        </div>
        <div className="flex sm:flex-col gap-2">
          <button onClick={share} className="flex items-center gap-2 bg-white text-primary-900 font-bold px-4 py-2.5 rounded-xl">
            {copied ? <Copy className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}{copied ? 'Lien copié' : 'Partager'}
          </button>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/10 ring-1 ring-white/30 font-semibold px-4 py-2.5 rounded-xl">
            <Linkedin className="w-4 h-4" />LinkedIn
          </a>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {p.bio && <Section title="À propos"><p className="text-gray-700 whitespace-pre-line">{p.bio}</p></Section>}
          <Section title="Certificats vérifiés" description="Chaque certificat peut être vérifié par son code." padded={false}>
            {p.certificates.length === 0 ? <p className="px-6 pb-6 text-sm text-gray-500">Aucun certificat pour l'instant.</p> : (
              <ul className="divide-y divide-gray-100">
                {p.certificates.map((c) => (
                  <li key={c.code} className="flex items-center gap-4 px-5 sm:px-6 py-4">
                    <span className="w-11 h-11 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center"><BadgeCheck className="w-6 h-6" /></span>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/courses/${c.course_slug}`)} className="font-semibold text-gray-900 hover:text-primary-700 text-left">{c.course}</button>
                      <p className="text-xs text-gray-500">Formateur : {c.instructor} · {new Date(c.issued_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <button onClick={() => navigate(`/certificates/verify/${c.code}`)} className="text-xs font-semibold text-primary-700 flex items-center gap-1 whitespace-nowrap">
                      Vérifier<ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          {p.skills.length > 0 && (
            <Section title="Compétences">
              <div className="flex flex-wrap gap-2">{p.skills.map((s) => <Badge key={s} tone="primary">{s}</Badge>)}</div>
            </Section>
          )}
          {p.badges.length > 0 && (
            <Section title="Badges">
              <ul className="space-y-3">
                {p.badges.map((b) => (
                  <li key={b.key} className="flex gap-3">
                    <span className="w-9 h-9 rounded-full bg-sun-100 text-sun-700 flex items-center justify-center flex-shrink-0"><Award className="w-4 h-4" /></span>
                    <span><span className="block text-sm font-semibold text-gray-900">{b.title}</span><span className="block text-xs text-gray-500">{b.description}</span></span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <p className="text-xs text-gray-400 text-center">Membre depuis {new Date(p.member_since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
};

/** Onglet Paramètres : activer son profil public et choisir son adresse. */
export const PublicProfileTab: React.FC = () => {
  const { data, setData, loading } = useApi(() => api.get('/analytics/public-profile/'), []);
  const [form, setForm] = useState<{ public_handle: string; headline: string } | null>(null);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  useEffect(() => { if (data) setForm({ public_handle: data.public_handle || '', headline: data.headline || '' }); }, [data]);
  if (loading || !data || !form) return <Spinner className="h-40" />;

  const save = async (patch: Record<string, unknown>) => {
    setMsg({ ok: '', err: '' });
    try {
      setData(await api.patch('/analytics/public-profile/', patch));
      setMsg({ ok: 'Enregistré.', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: (err as Error).message });
    }
  };
  const link = data.public_handle ? `${window.location.origin}/u/${data.public_handle}` : '';

  return (
    <div className="space-y-6 max-w-xl">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-primary-700" checked={data.public_profile} onChange={(e) => save({ public_profile: e.target.checked })} />
        <span>
          <span className="block font-semibold text-gray-900 flex items-center gap-2"><Globe className="w-4 h-4" />Profil public (portfolio)</span>
          <span className="block text-sm text-gray-500">Une page à partager avec un recruteur : certificats vérifiables, badges et compétences. Votre email et votre activité détaillée ne sont jamais affichés.</span>
        </span>
      </label>
      {data.public_profile && (
        <form onSubmit={(e) => { e.preventDefault(); save(form); }} className="space-y-4 pl-8">
          <Field label="Titre" hint="Ex. : Développeuse web junior · Data analyst en reconversion">
            <input className={inputClass} maxLength={120} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </Field>
          <Field label="Adresse du profil">
            <div className="flex items-center rounded-xl ring-1 ring-gray-200 overflow-hidden">
              <span className="px-3 text-sm text-gray-400 bg-gray-50 self-stretch flex items-center">/u/</span>
              <input className="flex-1 px-3 py-2.5 outline-none" value={form.public_handle}
                onChange={(e) => setForm({ ...form, public_handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} minLength={3} maxLength={40} />
            </div>
          </Field>
          <div className="flex flex-wrap gap-3">
            <button className={buttonPrimary}>Enregistrer</button>
            {link && <button type="button" onClick={() => navigate(`/u/${data.public_handle}`)} className="px-4 py-2.5 rounded-xl ring-1 ring-gray-200 font-semibold text-gray-700 flex items-center gap-2"><ExternalLink className="w-4 h-4" />Voir mon profil</button>}
          </div>
        </form>
      )}
      <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-100">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-primary-700" checked={data.show_in_leaderboard} onChange={(e) => save({ show_in_leaderboard: e.target.checked })} />
        <span>
          <span className="block font-semibold text-gray-900">Apparaître dans la ligue de la semaine</span>
          <span className="block text-sm text-gray-500">Seuls votre prénom, l'initiale de votre nom et vos minutes d'apprentissage sont affichés.</span>
        </span>
      </label>
      {msg.ok && <SuccessBox message={msg.ok} />}
      {msg.err && <ErrorBox message={msg.err} />}
    </div>
  );
};
