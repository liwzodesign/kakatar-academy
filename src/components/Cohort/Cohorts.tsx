import React, { useState } from 'react';
import { CalendarRange, Users, Plus, X, UsersRound } from 'lucide-react';
import { api } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBox, Modal, PageHeader, Spinner, EmptyState, SuccessBox, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, IconButton, Section, Table, Td } from '../UI/kit';
import { CheckoutModal } from '../Payment/CheckoutModal';

export interface Cohort {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  capacity: number;
  members_count: number;
  spots_left: number;
  price: number | string;
  currency: string;
  status: string;
  is_open: boolean;
  membership_status: string | null;
  course: { slug: string; title: string };
  sessions_count: number;
}

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Encart « Promotions » de la fiche d'un cours : apprendre en groupe, avec des dates et des sessions en direct. */
export const CourseCohorts: React.FC<{ slug: string; isOwner: boolean; onRequireAuth: () => void }> = ({ slug, isOwner, onRequireAuth }) => {
  const { authState } = useAuth();
  const { data, reload } = useApi(() => api.get<Cohort[]>(`/cohorts/course/${slug}/`), [slug, authState.isAuthenticated]);
  const [checkout, setCheckout] = useState<Cohort | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!data || data.length === 0 || isOwner) return null;

  const join = async (c: Cohort) => {
    if (!authState.isAuthenticated) return onRequireAuth();
    setError('');
    if (Number(c.price) > 0) return setCheckout(c);
    try {
      await api.post(`/cohorts/${c.id}/join/`, {});
      setNotice(`Bienvenue dans la promotion « ${c.title} » ! Les sessions en direct sont ajoutées à votre agenda.`);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Section title="Apprendre en promotion" description="Avancez avec un groupe, à dates fixes, avec des sessions en direct animées par le formateur.">
      <div className="space-y-3">
        {notice && <SuccessBox message={notice} />}
        {error && <ErrorBox message={error} />}
        {data.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-xl ring-1 ring-gray-200 p-4">
            <span className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><UsersRound className="w-5 h-5" /></span>
            <div className="flex-1 min-w-[12rem]">
              <p className="font-bold text-gray-900">{c.title}</p>
              <p className="text-sm text-gray-500 flex flex-wrap gap-x-3">
                <span className="flex items-center gap-1"><CalendarRange className="w-4 h-4" />{fmt(c.start_date)} → {fmt(c.end_date)}</span>
                <span>{c.sessions_count} session(s) live</span>
                <span>{c.spots_left} place(s) restante(s)</span>
              </p>
            </div>
            {c.membership_status === 'CONFIRMED' ? <Badge tone="secondary">Inscrit</Badge> : (
              <button disabled={!c.is_open} onClick={() => join(c)} className={buttonPrimary}>
                {!c.is_open ? 'Complet' : Number(c.price) > 0 ? `Rejoindre · ${formatPrice(Number(c.price), c.currency)}` : 'Rejoindre gratuitement'}
              </button>
            )}
          </div>
        ))}
      </div>
      {checkout && (
        <CheckoutModal title={`Promotion ${checkout.title}`} amount={Number(checkout.price)} currency={checkout.currency}
          onClose={() => setCheckout(null)}
          startCheckout={(gateway) => api.post(`/cohorts/${checkout.id}/join/`, { gateway })}
          onCompleted={reload} />
      )}
    </Section>
  );
};

const CohortForm: React.FC<{ courses: { slug: string; title: string }[]; onClose: () => void; onSaved: () => void }> = ({ courses, onClose, onSaved }) => {
  const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ course_slug: courses[0]?.slug || '', title: '', description: '', start_date: inDays(14), end_date: inDays(56), capacity: '30', price: '0', status: 'OPEN' });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/cohorts/instructor/', { ...form, capacity: Number(form.capacity), price: form.price || '0' });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title="Nouvelle promotion" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Cours" required>
          <select className={inputClass} value={form.course_slug} onChange={set('course_slug')}>
            {courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Nom de la promotion" required><input className={inputClass} value={form.title} onChange={set('title')} placeholder="Promo janvier 2027" required /></Field>
        <Field label="Description"><textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} placeholder="Rythme, sessions prévues, accompagnement…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" required><input type="date" className={inputClass} value={form.start_date} onChange={set('start_date')} required /></Field>
          <Field label="Fin" required><input type="date" className={inputClass} value={form.end_date} onChange={set('end_date')} required /></Field>
          <Field label="Places" required><input type="number" min={1} className={inputClass} value={form.capacity} onChange={set('capacity')} required /></Field>
          <Field label="Prix (FCFA)" hint="0 = gratuit"><input type="number" min={0} className={inputClass} value={form.price} onChange={set('price')} /></Field>
        </div>
        {error && <ErrorBox message={error} />}
        <button className={`${buttonPrimary} w-full`}>Créer la promotion</button>
      </form>
    </Modal>
  );
};

const Members: React.FC<{ cohort: Cohort; onClose: () => void }> = ({ cohort, onClose }) => {
  const { data, loading } = useApi(() => api.get<{ id: string; name: string; email: string; joined_at: string }[]>(`/cohorts/${cohort.id}/members/`), [cohort.id]);
  return (
    <Modal title={`Membres — ${cohort.title}`} onClose={onClose}>
      {loading ? <Spinner className="h-32" /> : !data?.length ? <p className="text-sm text-gray-500">Aucun membre pour l'instant.</p> : (
        <ul className="divide-y">
          {data.map((m) => (
            <li key={m.id} className="py-2.5 flex justify-between gap-3 text-sm">
              <span><span className="font-semibold text-gray-900">{m.name}</span><span className="block text-gray-500">{m.email}</span></span>
              <span className="text-gray-400 whitespace-nowrap">{new Date(m.joined_at).toLocaleDateString('fr-FR')}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

const STATUS: Record<string, [string, 'secondary' | 'sun' | 'danger']> = {
  OPEN: ['Inscriptions ouvertes', 'secondary'], CLOSED: ['Inscriptions closes', 'sun'], CANCELLED: ['Annulée', 'danger'],
};

/** Page formateur : gérer ses promotions. */
export const InstructorCohorts: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => {
    const [cohorts, courses] = await Promise.all([api.get<Cohort[]>('/cohorts/instructor/'), api.get<any[]>('/courses/mine/')]);
    return { cohorts, courses: courses.filter((c) => c.status === 'PUBLISHED').map((c) => ({ slug: c.slug, title: c.title })) };
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [members, setMembers] = useState<Cohort | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Promotions" subtitle="Faites avancer vos étudiants en groupe, avec des dates et des sessions live réservées à la promotion." action={
        <button onClick={() => setShowForm(true)} disabled={!data.courses.length} className={`${buttonPrimary} flex items-center gap-2`}><Plus className="w-4 h-4" />Nouvelle promotion</button>
      } />
      {data.cohorts.length === 0 ? (
        <EmptyState title="Aucune promotion" text={data.courses.length ? 'Créez une promotion, puis planifiez ses sessions live depuis la page Sessions.' : 'Publiez d’abord un cours.'} />
      ) : (
        <Section padded={false}>
          <Table head={['Promotion', 'Cours', 'Dates', 'Membres', 'Prix', 'Statut', '']}>
            {data.cohorts.map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold text-gray-900">{c.title}</Td>
                <Td className="text-gray-600">{c.course.title}</Td>
                <Td className="whitespace-nowrap text-gray-500">{fmt(c.start_date)} → {fmt(c.end_date)}</Td>
                <Td className="tabular-nums">{c.members_count} / {c.capacity}</Td>
                <Td className="whitespace-nowrap">{formatPrice(Number(c.price), c.currency)}</Td>
                <Td><Badge tone={STATUS[c.status]?.[1] || 'gray'}>{STATUS[c.status]?.[0] || c.status}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton label="Membres" onClick={() => setMembers(c)}><Users className="w-4 h-4" /></IconButton>
                  {c.status !== 'CANCELLED' && (
                    <IconButton label="Annuler la promotion" tone="danger" onClick={async () => { if (confirm(`Annuler la promotion ${c.title} ?`)) { await api.delete(`/cohorts/${c.id}/`); reload(); } }}><X className="w-4 h-4" /></IconButton>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {showForm && <CohortForm courses={data.courses} onClose={() => setShowForm(false)} onSaved={reload} />}
      {members && <Members cohort={members} onClose={() => setMembers(null)} />}
    </div>
  );
};
