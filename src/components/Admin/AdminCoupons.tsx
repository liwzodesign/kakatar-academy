import React, { useState } from 'react';
import { Plus, Tag, Trash2, Power } from 'lucide-react';
import { api, unwrap } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, IconButton, Section, Table, Td } from '../UI/kit';

interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discount_value: string;
  discount_display: string;
  minimum_amount: string;
  maximum_discount: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  is_valid: boolean;
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const CouponForm: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const now = new Date();
  const [form, setForm] = useState({
    code: '', description: '', discount_type: 'PERCENTAGE', discount_value: '10', minimum_amount: '0', maximum_discount: '',
    usage_limit: '', per_user_limit: '1', valid_from: toLocalInput(now), valid_until: toLocalInput(new Date(now.getTime() + 30 * 86400000)),
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments/coupons/', {
        ...form,
        code: form.code.trim().toUpperCase(),
        maximum_discount: form.maximum_discount || null,
        usage_limit: form.usage_limit || null,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: new Date(form.valid_until).toISOString(),
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
          <Field label="Code" required><input className={`${inputClass} uppercase font-mono`} value={form.code} onChange={set('code')} placeholder="RENTREE25" required /></Field>
          <Field label="Type">
            <select className={inputClass} value={form.discount_type} onChange={set('discount_type')}>
              <option value="PERCENTAGE">Pourcentage</option>
              <option value="FIXED_AMOUNT">Montant fixe</option>
            </select>
          </Field>
          <Field label={form.discount_type === 'PERCENTAGE' ? 'Remise (%)' : 'Remise (FCFA)'} required>
            <input type="number" min={1} max={form.discount_type === 'PERCENTAGE' ? 100 : undefined} className={inputClass} value={form.discount_value} onChange={set('discount_value')} required />
          </Field>
          <Field label="Achat minimum (FCFA)"><input type="number" min={0} className={inputClass} value={form.minimum_amount} onChange={set('minimum_amount')} /></Field>
          {form.discount_type === 'PERCENTAGE' && <Field label="Remise maximale (FCFA)" hint="Facultatif"><input type="number" min={0} className={inputClass} value={form.maximum_discount} onChange={set('maximum_discount')} /></Field>}
          <Field label="Utilisations totales" hint="Vide = illimité"><input type="number" min={1} className={inputClass} value={form.usage_limit} onChange={set('usage_limit')} /></Field>
          <Field label="Par utilisateur"><input type="number" min={1} className={inputClass} value={form.per_user_limit} onChange={set('per_user_limit')} /></Field>
          <Field label="Début"><input type="datetime-local" className={inputClass} value={form.valid_from} onChange={set('valid_from')} /></Field>
          <Field label="Fin"><input type="datetime-local" className={inputClass} value={form.valid_until} onChange={set('valid_until')} /></Field>
        </div>
        <Field label="Description interne"><input className={inputClass} value={form.description} onChange={set('description')} placeholder="Campagne de rentrée" /></Field>
        {error && <ErrorBox message={error} />}
        <button className={`${buttonPrimary} w-full`}>Créer le code</button>
      </form>
    </Modal>
  );
};

export const AdminCoupons: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => unwrap<Coupon>(await api.get('/payments/coupons/')), []);
  const [showForm, setShowForm] = useState(false);

  const toggle = async (c: Coupon) => {
    await api.patch(`/payments/coupons/${c.id}/`, { status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    reload();
  };
  const remove = async (c: Coupon) => {
    if (!confirm(`Supprimer le code ${c.code} ?`)) return;
    await api.delete(`/payments/coupons/${c.id}/`);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Codes promo" subtitle="Créez des réductions pour vos campagnes" action={
        <button onClick={() => setShowForm(true)} className={`${buttonPrimary} flex items-center gap-2`}><Plus className="w-4 h-4" />Nouveau code</button>
      } />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : !data?.length ? <EmptyState title="Aucun code promo" text="Créez votre premier code pour lancer une campagne." /> : (
        <Section padded={false}>
          <Table head={['Code', 'Remise', 'Utilisations', 'Validité', 'Statut', '']}>
            {data.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/60">
                <Td>
                  <span className="inline-flex items-center gap-2 font-mono font-bold text-primary-800"><Tag className="w-4 h-4 text-sun-600" />{c.code}</span>
                  {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                </Td>
                <Td>
                  <span className="font-bold text-gray-900">{c.discount_display}{c.discount_type === 'FIXED_AMOUNT' ? ' FCFA' : ''}</span>
                  {Number(c.minimum_amount) > 0 && <p className="text-xs text-gray-500">dès {formatPrice(Number(c.minimum_amount))}</p>}
                </Td>
                <Td className="tabular-nums">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</Td>
                <Td className="text-gray-500 whitespace-nowrap">{new Date(c.valid_from).toLocaleDateString('fr-FR')} → {new Date(c.valid_until).toLocaleDateString('fr-FR')}</Td>
                <Td>{c.is_valid ? <Badge tone="secondary">Actif</Badge> : c.status === 'INACTIVE' ? <Badge tone="gray">Désactivé</Badge> : <Badge tone="danger">Expiré / épuisé</Badge>}</Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton label={c.status === 'ACTIVE' ? 'Désactiver' : 'Activer'} onClick={() => toggle(c)}><Power className="w-4 h-4" /></IconButton>
                  <IconButton label="Supprimer" tone="danger" onClick={() => remove(c)}><Trash2 className="w-4 h-4" /></IconButton>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {showForm && <CouponForm onClose={() => setShowForm(false)} onSaved={reload} />}
    </div>
  );
};
