import React, { useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, CheckCircle2, Clock, Layers, Pencil, Plus, Route, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration, formatPrice, LEVEL_LABELS } from '../../lib/format';
import { FALLBACK_THUMBNAIL } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner, SuccessBox, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, IconButton, ProgressBar, Section, Table, Td } from '../UI/kit';
import { CheckoutModal } from '../Payment/CheckoutModal';

interface PathSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  level: string;
  price: string | number;
  currency: string;
  status: string;
  total_value: string | number;
  savings: string | number;
  courses_count: number;
  duration: number;
  creator: { id: string; name: string };
  is_owner: boolean;
}

interface PathDetailData extends PathSummary {
  courses: { id: string; slug: string; title: string; thumbnail?: string; thumbnail_url?: string; duration: number; price: string | number; enrolled: boolean; progress: number }[];
  owned_count: number;
  progress: number;
}

const PathCard: React.FC<{ p: PathSummary }> = ({ p }) => (
  <button onClick={() => navigate(`/paths/${p.slug}`)} className="text-left bg-white rounded-2xl shadow-card ring-1 ring-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
    <div className="relative aspect-[16/8] bg-primary-900">
      <img src={p.thumbnail || FALLBACK_THUMBNAIL} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
      <span className="absolute top-3 left-3"><Badge tone="sun" icon={Layers}>{p.courses_count} cours</Badge></span>
    </div>
    <div className="p-5 space-y-2">
      <p className="text-xs font-semibold text-secondary-700 uppercase tracking-wide">{LEVEL_LABELS[p.level] || p.level}</p>
      <h3 className="font-bold text-gray-900 leading-snug line-clamp-2">{p.title}</h3>
      {p.subtitle && <p className="text-sm text-gray-500 line-clamp-2">{p.subtitle}</p>}
      <div className="flex items-end justify-between pt-2">
        <span className="text-sm text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(p.duration)}</span>
        <span className="text-right">
          {Number(p.savings) > 0 && <span className="block text-xs text-gray-400 line-through">{formatPrice(Number(p.total_value), p.currency)}</span>}
          <span className="font-extrabold text-primary-800">{formatPrice(Number(p.price), p.currency)}</span>
        </span>
      </div>
    </div>
  </button>
);

/** Catalogue public des parcours. */
export const PathList: React.FC = () => {
  const { data, loading, error, reload } = useApi(() => api.get<PathSummary[]>('/paths/'), []);
  return (
    <div className="space-y-6">
      <PageHeader title="Parcours" subtitle="Des cours regroupés dans le bon ordre pour atteindre un objectif — moins cher qu'à l'unité." />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="Aucun parcours pour l'instant" text="Revenez bientôt, ou explorez le catalogue des cours." action={<button className={buttonPrimary} onClick={() => navigate('/catalog')}>Voir le catalogue</button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.map((p) => <PathCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
};

/** Fiche d'un parcours : étapes, progression, achat groupé. */
export const PathDetail: React.FC<{ slug: string; onRequireAuth: () => void }> = ({ slug, onRequireAuth }) => {
  const { authState } = useAuth();
  const { data: p, loading, error, reload } = useApi(() => api.get<PathDetailData>(`/paths/${slug}/`), [slug, authState.isAuthenticated]);
  const [checkout, setCheckout] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading) return <Spinner />;
  if (error || !p) return <ErrorBox message={error || 'Parcours introuvable'} onRetry={reload} />;

  const ownsAll = p.owned_count === p.courses.length && p.courses.length > 0;
  const next = p.courses.find((c) => c.enrolled && c.progress < 100) || p.courses.find((c) => c.enrolled);

  const enroll = async () => {
    if (!authState.isAuthenticated) return onRequireAuth();
    setActionError('');
    if (Number(p.price) > 0) return setCheckout(true);
    try {
      await api.post(`/paths/${p.slug}/enroll/`, {});
      setNotice('Vous êtes inscrit à tous les cours du parcours. Bon apprentissage !');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-secondary-500/20 blur-2xl" aria-hidden />
        <div className="relative max-w-3xl space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sun" icon={Route}>Parcours</Badge>
            <Badge tone="gray">{LEVEL_LABELS[p.level] || p.level}</Badge>
            {p.status !== 'PUBLISHED' && <Badge tone="danger">{p.status === 'DRAFT' ? 'Brouillon' : 'Archivé'}</Badge>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{p.title}</h1>
          {p.subtitle && <p className="text-lg text-white/80">{p.subtitle}</p>}
          <p className="text-sm text-white/70 flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{p.courses_count} cours</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(p.duration)}</span>
            <span>par {p.creator.name}</span>
          </p>
          {p.owned_count > 0 && (
            <div className="max-w-md pt-2">
              <ProgressBar value={p.progress} tone="secondary" label={`Progression du parcours : ${p.progress} %`} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {ownsAll ? (
              next && <button onClick={() => navigate(`/learn/${next.slug}`)} className="bg-white text-primary-900 font-bold px-6 py-3 rounded-xl">Continuer : {next.title}</button>
            ) : !p.is_owner && (
              <>
                <button onClick={enroll} className="bg-secondary-500 hover:bg-secondary-600 text-white font-bold px-6 py-3 rounded-xl">
                  {Number(p.price) > 0 ? `Obtenir le parcours · ${formatPrice(Number(p.price), p.currency)}` : 'Commencer gratuitement'}
                </button>
                {Number(p.savings) > 0 && <span className="text-sm text-white/80">au lieu de <s>{formatPrice(Number(p.total_value), p.currency)}</s> — vous économisez {formatPrice(Number(p.savings), p.currency)}</span>}
              </>
            )}
            {p.is_owner && <button onClick={() => navigate('/my-paths')} className="bg-white/10 ring-1 ring-white/30 font-semibold px-5 py-3 rounded-xl">Gérer mes parcours</button>}
          </div>
        </div>
      </div>

      {notice && <SuccessBox message={notice} />}
      {actionError && <ErrorBox message={actionError} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Les étapes" className="lg:col-span-2">
          <ol className="relative space-y-4">
            {p.courses.map((c, i) => (
              <li key={c.id} className="flex gap-4">
                <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${c.progress >= 100 ? 'bg-secondary-500 text-white' : c.enrolled ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {c.progress >= 100 ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </span>
                <button onClick={() => navigate(c.enrolled ? `/learn/${c.slug}` : `/courses/${c.slug}`)} className="flex-1 min-w-0 flex gap-4 items-center text-left rounded-xl ring-1 ring-gray-100 p-3 hover:bg-gray-50">
                  <img src={c.thumbnail || c.thumbnail_url || FALLBACK_THUMBNAIL} alt="" className="w-20 h-14 rounded-lg object-cover hidden sm:block" loading="lazy" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900 truncate">{c.title}</span>
                    <span className="block text-xs text-gray-500">{formatDuration(c.duration)}{c.enrolled ? '' : ` · ${formatPrice(Number(c.price))} à l'unité`}</span>
                    {c.enrolled && <ProgressBar value={c.progress} className="mt-2" />}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="À propos de ce parcours">
          <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.description}</p>
        </Section>
      </div>

      {checkout && (
        <CheckoutModal title={`Parcours ${p.title}`} amount={Number(p.price)} currency={p.currency}
          onClose={() => setCheckout(false)}
          startCheckout={(gateway) => api.post(`/paths/${p.slug}/enroll/`, { gateway })}
          onCompleted={reload} />
      )}
    </div>
  );
};

type MyCourse = { slug: string; title: string; price: number };

const PathForm: React.FC<{ courses: MyCourse[]; path?: PathDetailData; onClose: () => void; onSaved: () => void }> = ({ courses, path, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: path?.title || '', subtitle: path?.subtitle || '', description: path?.description || '',
    level: path?.level || 'DEBUTANT', price: path ? String(Number(path.price)) : '', status: path?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  });
  const [slugs, setSlugs] = useState<string[]>(path?.courses.map((c) => c.slug) || []);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const total = slugs.reduce((n, s) => n + (courses.find((c) => c.slug === s)?.price || 0), 0);
  const move = (i: number, d: number) => {
    const next = [...slugs];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSlugs(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, price: form.price || '0', course_slugs: slugs };
      if (path) await api.put(`/paths/${path.slug}/`, body);
      else await api.post('/paths/', body);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={path ? 'Modifier le parcours' : 'Nouveau parcours'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Titre" required><input className={inputClass} value={form.title} onChange={set('title')} placeholder="Devenir développeur web" required /></Field>
        <Field label="Sous-titre"><input className={inputClass} value={form.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Description" required><textarea className={inputClass} rows={4} value={form.description} onChange={set('description')} required /></Field>
        <Field label="Cours, dans l'ordre (2 minimum)" required>
          <div className="space-y-2">
            {slugs.map((s, i) => (
              <div key={s} className="flex items-center gap-2 rounded-xl ring-1 ring-gray-200 px-3 py-2 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary-700 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="flex-1 truncate">{courses.find((c) => c.slug === s)?.title || s}</span>
                <IconButton type="button" label="Monter" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></IconButton>
                <IconButton type="button" label="Descendre" disabled={i === slugs.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></IconButton>
                <IconButton type="button" label="Retirer" tone="danger" onClick={() => setSlugs(slugs.filter((x) => x !== s))}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            ))}
            {courses.some((c) => !slugs.includes(c.slug)) && (
              <select className={inputClass} value="" onChange={(e) => e.target.value && setSlugs([...slugs, e.target.value])}>
                <option value="">+ Ajouter un cours…</option>
                {courses.filter((c) => !slugs.includes(c.slug)).map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
              </select>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Niveau">
            <select className={inputClass} value={form.level} onChange={set('level')}>
              {Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Prix (FCFA)" hint={total ? `Valeur : ${formatPrice(total)}` : undefined}>
            <input type="number" min={0} max={total || undefined} className={inputClass} value={form.price} onChange={set('price')} placeholder="0" />
          </Field>
          <Field label="Statut">
            <select className={inputClass} value={form.status} onChange={set('status')}>
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
            </select>
          </Field>
        </div>
        {error && <ErrorBox message={error} />}
        <button disabled={slugs.length < 2} className={`${buttonPrimary} w-full`}>{path ? 'Enregistrer' : 'Créer le parcours'}</button>
      </form>
    </Modal>
  );
};

/** Page formateur : créer et gérer ses parcours. */
export const MyPaths: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => {
    const [paths, courses] = await Promise.all([api.get<PathSummary[]>('/paths/?mine=true'), api.get<any[]>('/courses/mine/')]);
    return { paths, courses: courses.filter((c) => c.status === 'PUBLISHED').map((c) => ({ slug: c.slug, title: c.title, price: Number(c.price) })) as MyCourse[] };
  }, []);
  const [editing, setEditing] = useState<PathDetailData | null | 'new'>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  const edit = async (slug: string) => setEditing(await api.get<PathDetailData>(`/paths/${slug}/`));

  return (
    <div className="space-y-6">
      <PageHeader title="Mes parcours" subtitle="Regroupez vos cours en un programme complet, vendu à prix réduit." action={
        <button onClick={() => setEditing('new')} disabled={data.courses.length < 2} className={`${buttonPrimary} flex items-center gap-2`}><Plus className="w-4 h-4" />Nouveau parcours</button>
      } />
      {data.paths.length === 0 ? (
        <EmptyState title="Aucun parcours" text={data.courses.length < 2 ? 'Il faut au moins deux cours publiés pour créer un parcours.' : 'Créez votre premier parcours en quelques clics.'} />
      ) : (
        <Section padded={false}>
          <Table head={['Parcours', 'Cours', 'Prix', 'Statut', '']}>
            {data.paths.map((p) => (
              <tr key={p.id}>
                <Td><button onClick={() => navigate(`/paths/${p.slug}`)} className="font-semibold text-gray-900 hover:text-primary-700 text-left">{p.title}</button></Td>
                <Td className="tabular-nums">{p.courses_count}</Td>
                <Td className="whitespace-nowrap">{formatPrice(Number(p.price), p.currency)}</Td>
                <Td>{p.status === 'PUBLISHED' ? <Badge tone="secondary">Publié</Badge> : <Badge tone="gray">Brouillon</Badge>}</Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton label="Modifier" onClick={() => edit(p.slug)}><Pencil className="w-4 h-4" /></IconButton>
                  <IconButton label="Archiver" tone="danger" onClick={async () => { if (confirm(`Archiver le parcours ${p.title} ?`)) { await api.delete(`/paths/${p.slug}/`); reload(); } }}><Trash2 className="w-4 h-4" /></IconButton>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {editing && <PathForm courses={data.courses} path={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      <p className="text-xs text-gray-400">Le prix d'un parcours ne peut pas dépasser la somme de ses cours. Vos revenus sont répartis au prorata du prix de chaque cours.</p>
    </div>
  );
};
