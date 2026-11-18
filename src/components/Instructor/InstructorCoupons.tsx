import React, { useState } from 'react';
import { Plus, Tag, Trash2, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, IconButton, Section, Table, Td } from '../UI/kit';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_display: string;
  usage_count: number;
  usage_limit: number | null;
  valid_until: string;
  status: string;
  is_valid: boolean;
  applicable_courses: string[];
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const CouponForm: React.FC<{ courses: { id: string; title: string }[]; onClose: () => void; onSaved: () => void }> = ({ courses, onClose, onSaved }) => {
  const now = new Date();
  const [form, setForm] = useState({
    code: '', discount_type: 'PERCENTAGE', discount_value: '20', usage_limit: '', valid_until: toLocalInput(new Date(now.getTime() + 14 * 86400000)),
  });
  const [selected, setSelected] = useState<string[]>(courses.slice(0, 1).map((c) => c.id));
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments/instructor/coupons/', {
        code: form.code.trim().toUpperCase(), discount_type: form.discount_type, discount_value: form.discount_value,
        usage_limit: form.usage_limit || null, per_user_limit: 1, valid_from: now.toISOString(),
        valid_until: new Date(form.valid_until).toISOString(), applicable_courses: selected,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title="Nouveau code promo" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required><input className={`${inputClass} uppercase font-mono`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="LANCEMENT" required /></Field>
          <Field label="Type">
            <select className={inputClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="PERCENTAGE">Pourcentage</option>
              <option value="FIXED_AMOUNT">Montant fixe</option>
            </select>
          </Field>
          <Field label={form.discount_type === 'PERCENTAGE' ? 'Remise (%, 90 max)' : 'Remise (FCFA)'} required>
            <input type="number" min={1} max={form.discount_type === 'PERCENTAGE' ? 90 : undefined} className={inputClass} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required />
          </Field>
          <Field label="Utilisations max." hint="Vide = illimité"><input type="number" min={1} className={inputClass} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></Field>
        </div>
        <Field label="Valable jusqu'au"><input type="datetime-local" className={inputClass} value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
        <Field label="Cours concernés" required>
          <div className="max-h-48 overflow-y-auto rounded-xl ring-1 ring-gray-200 divide-y">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="accent-primary-700" checked={selected.includes(c.id)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))} />
                {c.title}
              </label>
            ))}
          </div>
        </Field>
        <p className="text-xs text-gray-500">La remise s'applique sur vos ventes : votre part est calculée sur le prix remisé.</p>
        {error && <ErrorBox message={error} />}
        <button disabled={!selected.length || !form.code.trim()} className={`${buttonPrimary} w-full`}>Créer le code</button>
      </form>
    </Modal>
  );
};

export const InstructorCoupons: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => {
    const [coupons, courses] = await Promise.all([api.get<Coupon[]>('/payments/instructor/coupons/'), api.get<any[]>('/courses/mine/')]);
    return { coupons, courses: courses.filter((c) => c.status === 'PUBLISHED' && Number(c.price) > 0).map((c) => ({ id: c.id, title: c.title })) };
  }, []);
  const [showForm, setShowForm] = useState(false);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
  const titleOf = (id: string) => data.courses.find((c) => c.id === id)?.title || 'Cours';

  return (
    <div className="space-y-6">
      <PageHeader title="Mes codes promo" subtitle="Faites la promotion de vos cours (lancement, réseaux sociaux, partenaires)" action={
        <button onClick={() => setShowForm(true)} disabled={!data.courses.length} className={`${buttonPrimary} flex items-center gap-2`}><Plus className="w-4 h-4" />Nouveau code</button>
      } />
      {!data.courses.length && <EmptyState title="Aucun cours payant publié" text="Les codes promo s'appliquent à vos cours payants publiés." />}
      {data.coupons.length > 0 && (
        <Section padded={false}>
          <Table head={['Code', 'Remise', 'Cours', 'Utilisations', 'Fin', 'Statut', '']}>
            {data.coupons.map((c) => (
              <tr key={c.id}>
                <Td><span className="inline-flex items-center gap-2 font-mono font-bold text-primary-800"><Tag className="w-4 h-4 text-sun-600" />{c.code}</span></Td>
                <Td className="font-bold">{c.discount_display}{c.discount_type === 'FIXED_AMOUNT' ? ' FCFA' : ''}</Td>
                <Td className="text-gray-600 max-w-[16rem]"><span className="line-clamp-2">{c.applicable_courses.map(titleOf).join(', ')}</span></Td>
                <Td className="tabular-nums">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</Td>
                <Td className="text-gray-500 whitespace-nowrap">{new Date(c.valid_until).toLocaleDateString('fr-FR')}</Td>
                <Td>{c.is_valid ? <Badge tone="secondary">Actif</Badge> : <Badge tone="gray">Inactif</Badge>}</Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton label={c.status === 'ACTIVE' ? 'Désactiver' : 'Activer'} onClick={async () => { await api.patch(`/payments/instructor/coupons/${c.id}/`, { status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }); reload(); }}><Power className="w-4 h-4" /></IconButton>
                  <IconButton label="Supprimer" tone="danger" onClick={async () => { if (confirm(`Supprimer ${c.code} ?`)) { await api.delete(`/payments/instructor/coupons/${c.id}/`); reload(); } }}><Trash2 className="w-4 h-4" /></IconButton>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {showForm && <CouponForm courses={data.courses} onClose={() => setShowForm(false)} onSaved={reload} />}
    </div>
  );
};
