import React, { useEffect, useState } from 'react';
import { Wallet, Send, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { useApi } from '../../hooks/useApi';
import { Avatar, EmptyState, ErrorBox, Modal, Spinner, SuccessBox, buttonPrimary, inputClass } from '../UI';
import { Badge, Field, Section, Table, Tabs, Td } from '../UI/kit';

interface Payout {
  id: string;
  amount: string;
  method: string;
  method_display: string;
  account: string;
  account_name: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  status_display: string;
  admin_note: string;
  transaction_reference: string;
  created_at: string;
  processed_at: string | null;
  instructor: { id: string; name: string; email: string };
  sales: number;
}

const STATUS_TONE = { PENDING: 'sun', PAID: 'secondary', REJECTED: 'danger' } as const;
const METHODS = [
  { value: 'WAVE', label: 'Wave', hint: 'Numéro Wave' },
  { value: 'ORANGE_MONEY', label: 'Orange Money', hint: 'Numéro Orange Money' },
  { value: 'FREE_MONEY', label: 'Free Money', hint: 'Numéro Free Money' },
  { value: 'BANK_TRANSFER', label: 'Virement bancaire', hint: 'IBAN' },
];

/** Bloc « Mes versements » du formateur. */
export const InstructorPayouts: React.FC = () => {
  const { data, loading, error, reload } = useApi(() => api.get('/payments/payouts/'), []);
  const [form, setForm] = useState({ method: 'WAVE', account: '', account_name: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data?.last_account) setForm(data.last_account);
  }, [data?.last_account]);

  if (loading) return <Spinner className="h-40" />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  const available = Number(data.available);
  const canRequest = available >= data.minimum && !data.has_pending;
  const method = METHODS.find((m) => m.value === form.method) || METHODS[0];

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.post('/payments/payouts/', form);
      setDone(true);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Mes versements" description="Recevez vos revenus sur votre compte mobile ou bancaire.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl bg-brand-gradient text-white p-6 flex flex-col justify-between min-h-[11rem]">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium"><Wallet className="w-4 h-4" />Solde disponible</div>
          <p className="text-4xl font-extrabold tabular-nums mt-2">{formatMoney(available)}</p>
          <p className="text-sm text-white/70 mt-2">
            {data.has_pending ? 'Une demande est en cours de traitement.' : available < data.minimum ? `Versement possible dès ${formatMoney(data.minimum)}.` : 'Vous pouvez demander votre versement.'}
          </p>
        </div>
        {done ? (
          <SuccessBox message="Demande envoyée. Vous serez notifié dès que le versement sera effectué." />
        ) : (
          <form onSubmit={request} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Moyen de versement">
              {METHODS.map((m) => (
                <button type="button" key={m.value} role="radio" aria-checked={form.method === m.value} onClick={() => setForm({ ...form, method: m.value })}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold ring-1 transition-all ${form.method === m.value ? 'ring-2 ring-primary-600 bg-primary-50 text-primary-800' : 'ring-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={method.hint} required>
                <input className={inputClass} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}
                  inputMode={form.method === 'BANK_TRANSFER' ? 'text' : 'tel'} placeholder={form.method === 'BANK_TRANSFER' ? 'SN08 …' : '+221 77 000 00 00'} />
              </Field>
              <Field label="Titulaire du compte" required>
                <input className={inputClass} value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
              </Field>
            </div>
            {formError && <ErrorBox message={formError} />}
            <button disabled={!canRequest || busy || form.account.trim().length < 6 || form.account_name.trim().length < 2}
              className={`${buttonPrimary} w-full flex items-center justify-center gap-2`}>
              <Send className="w-4 h-4" />{busy ? 'Envoi…' : `Demander le versement de ${formatMoney(available)}`}
            </button>
          </form>
        )}
      </div>

      {data.requests.length > 0 && (
        <div className="mt-6 -mx-5 sm:-mx-6 border-t border-gray-100">
          <Table head={['Date', 'Montant', 'Moyen', 'Statut', 'Détail']}>
            {data.requests.map((p: Payout) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-gray-500">{new Date(p.created_at).toLocaleDateString('fr-FR')}</Td>
                <Td className="font-bold tabular-nums">{formatMoney(Number(p.amount))}</Td>
                <Td>{p.method_display} · <span className="text-gray-500">{p.account}</span></Td>
                <Td><Badge tone={STATUS_TONE[p.status]}>{p.status_display}</Badge></Td>
                <Td className="text-gray-500 text-xs">{p.transaction_reference ? `Réf. ${p.transaction_reference}` : p.admin_note}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Section>
  );
};

/** Traitement des demandes de versement (admin). */
export const AdminPayoutRequests: React.FC = () => {
  const [status, setStatus] = useState<'PENDING' | 'PAID' | 'REJECTED'>('PENDING');
  const { data, loading, error, reload } = useApi<Payout[]>(() => api.get('/payments/admin/payout-requests/', { status }), [status]);
  const [action, setAction] = useState<{ payout: Payout; kind: 'paid' | 'reject' } | null>(null);
  const [text, setText] = useState('');
  const [actionError, setActionError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setActionError('');
    try {
      await api.post(`/payments/admin/payout-requests/${action.payout.id}/`, action.kind === 'paid'
        ? { action: 'paid', transaction_reference: text } : { action: 'reject', admin_note: text });
      setAction(null);
      setText('');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={status} onChange={setStatus} items={[{ value: 'PENDING', label: 'À traiter' }, { value: 'PAID', label: 'Versées' }, { value: 'REJECTED', label: 'Refusées' }]} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : !data?.length ? <EmptyState title="Aucune demande" text={status === 'PENDING' ? 'Les formateurs demandent leur versement depuis « Revenus & stats ».' : undefined} /> : (
        <Section padded={false}>
          <Table head={['Formateur', 'Montant', 'Où verser', 'Demandé le', '']}>
            {data.map((p) => (
              <tr key={p.id}>
                <Td><div className="flex items-center gap-3"><Avatar name={p.instructor.name} size="w-9 h-9" /><div><p className="font-semibold text-gray-900">{p.instructor.name}</p><p className="text-gray-500">{p.sales} vente(s)</p></div></div></Td>
                <Td className="font-extrabold text-primary-800 tabular-nums">{formatMoney(Number(p.amount))}</Td>
                <Td><p className="font-semibold">{p.method_display}</p><p className="font-mono text-gray-700">{p.account}</p><p className="text-xs text-gray-500">{p.account_name}</p></Td>
                <Td className="text-gray-500 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString('fr-FR')}</Td>
                <Td className="text-right whitespace-nowrap">
                  {p.status === 'PENDING' ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setAction({ payout: p, kind: 'paid' }); setText(''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary-500 hover:bg-secondary-600 text-white text-sm font-semibold"><CheckCircle2 className="w-4 h-4" />Versé</button>
                      <button onClick={() => { setAction({ payout: p, kind: 'reject' }); setText(''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-gray-200 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600"><XCircle className="w-4 h-4" />Refuser</button>
                    </div>
                  ) : <Badge tone={STATUS_TONE[p.status]}>{p.status_display}</Badge>}
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
      {action && (
        <Modal title={action.kind === 'paid' ? 'Confirmer le versement' : 'Refuser la demande'} onClose={() => setAction(null)}>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-600">
              {formatMoney(Number(action.payout.amount))} pour {action.payout.instructor.name} — {action.payout.method_display} {action.payout.account}
            </p>
            <Field label={action.kind === 'paid' ? 'Référence de la transaction' : 'Motif du refus'} required={action.kind === 'reject'}
              hint={action.kind === 'paid' ? 'Visible par le formateur.' : 'Le solde redevient disponible pour le formateur.'}>
              <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            </Field>
            {actionError && <ErrorBox message={actionError} />}
            <button disabled={action.kind === 'reject' && !text.trim()} className={`${buttonPrimary} w-full`}>
              {action.kind === 'paid' ? 'Marquer comme versé' : 'Refuser la demande'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
