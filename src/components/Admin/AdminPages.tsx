import React, { useState } from 'react';
import { Download, FileText, ShieldCheck, ShieldX, HelpCircle, Ban, RotateCcw, Search, Users, CreditCard, Wallet, BarChart3 } from 'lucide-react';
import { api, downloadFile, unwrap } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { mapPayment, mapUser } from '../../lib/mappers';
import { navigate, useLocation } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { Avatar, EmptyState, ErrorBox, PageHeader, Spinner, buttonPrimary, buttonSecondary, inputClass } from '../UI';
import { Badge, Section, Table, Tabs, Td } from '../UI/kit';
import { AdminPayoutRequests } from '../Payment/Payouts';

const ROLES: Record<string, { label: string; tone: 'primary' | 'secondary' | 'sun' | 'gray' }> = {
  ETUDIANT: { label: 'Étudiant', tone: 'primary' },
  FORMATEUR: { label: 'Formateur', tone: 'secondary' },
  ADMIN: { label: 'Administrateur', tone: 'sun' },
  MODERATEUR: { label: 'Modérateur', tone: 'gray' },
  PARTENAIRE: { label: 'Partenaire', tone: 'gray' },
};
const backendBase = ((import.meta.env.VITE_API_URL as string) || '/api/v1').replace(/\/api\/v1\/?$/, '');

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative flex-1">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${inputClass} pl-10`} />
  </div>
);

const Pager: React.FC<{ hasPrev: boolean; hasNext: boolean; page: number; onPage: (p: number) => void }> = ({ hasPrev, hasNext, page, onPage }) =>
  hasPrev || hasNext ? (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm">
      <button disabled={!hasPrev} onClick={() => onPage(page - 1)} className="font-semibold text-gray-600 disabled:opacity-30">← Précédent</button>
      <span className="text-gray-500">Page {page}</span>
      <button disabled={!hasNext} onClick={() => onPage(page + 1)} className="font-semibold text-gray-600 disabled:opacity-30">Suivant →</button>
    </div>
  ) : null;

/* ------------------------------------------------------------------ Utilisateurs */
export const AdminUsers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.get('/auth/admin/users/', { search, role, page }), [search, role, page]);

  const update = async (id: string, body: Record<string, any>) => {
    try {
      await api.post(`/auth/admin/users/${id}/`, body);
      reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle={data ? `${data.count} compte(s)` : undefined} action={
        <button onClick={() => downloadFile('/analytics/export/users/', 'utilisateurs.csv')} className={`${buttonSecondary} flex items-center gap-2`}><Download className="w-4 h-4" />Exporter (CSV)</button>
      } />
      <Section padded={false}>
        <div className="flex flex-col sm:flex-row gap-3 px-5 pt-5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher par nom ou email" />
          <Tabs value={role} onChange={(v) => { setRole(v); setPage(1); }} items={[
            { value: '', label: 'Tous' }, { value: 'ETUDIANT', label: 'Étudiants' }, { value: 'FORMATEUR', label: 'Formateurs' }, { value: 'ADMIN', label: 'Admins' },
          ]} />
        </div>
        {error && <div className="p-5"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading ? <Spinner className="h-60" /> : (
          <>
            <Table head={['Utilisateur', 'Rôle', 'Vérification', 'Inscription', 'Statut', '']}
              empty={!unwrap(data).length && <p className="p-10 text-center text-gray-500">Aucun utilisateur trouvé.</p>}>
              {unwrap(data).map((raw: any) => {
                const u = mapUser(raw);
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.avatar} size="w-9 h-9" />
                        <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{u.name}</p><p className="text-gray-500 truncate">{u.email}</p></div>
                      </div>
                    </Td>
                    <Td>
                      <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} aria-label={`Rôle de ${u.name}`}
                        className="text-sm font-semibold rounded-lg bg-gray-50 ring-1 ring-gray-200 px-2 py-1.5 outline-none focus:ring-primary-300">
                        {Object.entries(ROLES).map(([value, r]) => <option key={value} value={value}>{r.label}</option>)}
                      </select>
                    </Td>
                    <Td>
                      {u.verificationStatus === 'VERIFIED' ? <Badge tone="secondary" icon={ShieldCheck}>Vérifié</Badge>
                        : u.role === 'FORMATEUR' ? <Badge tone="sun">En attente</Badge> : <span className="text-gray-300">—</span>}
                    </Td>
                    <Td className="text-gray-500 whitespace-nowrap">{u.createdAt.toLocaleDateString('fr-FR')}</Td>
                    <Td>{raw.is_banned ? <Badge tone="danger">Suspendu</Badge> : <Badge tone="secondary">Actif</Badge>}</Td>
                    <Td className="text-right">
                      {raw.is_banned ? (
                        <button onClick={() => update(u.id, { is_banned: false })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-700 px-2.5 py-1.5 rounded-lg hover:bg-secondary-50">
                          <RotateCcw className="w-4 h-4" />Réactiver
                        </button>
                      ) : (
                        <button onClick={() => confirm(`Suspendre ${u.email} ?`) && update(u.id, { is_banned: true })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600">
                          <Ban className="w-4 h-4" />Suspendre
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
            <Pager hasPrev={!!data.previous} hasNext={!!data.next} page={page} onPage={setPage} />
          </>
        )}
      </Section>
    </div>
  );
};

/* ------------------------------------------------------------------ Vérifications */
const VERIF_STATUS: Record<string, { label: string; tone: 'sun' | 'secondary' | 'danger' | 'gray' }> = {
  PENDING: { label: 'En attente', tone: 'sun' }, UNDER_REVIEW: { label: 'En examen', tone: 'sun' },
  NEEDS_MORE_INFO: { label: 'Infos demandées', tone: 'gray' }, APPROVED: { label: 'Approuvée', tone: 'secondary' },
  REJECTED: { label: 'Refusée', tone: 'danger' },
};

export const AdminModeration: React.FC = () => {
  const [status, setStatus] = useState('PENDING');
  const { data, loading, error, reload } = useApi(async () => unwrap(await api.get('/auth/verification/all/', { status })), [status]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const decide = async (id: number, decision: 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO') => {
    await api.patch(`/auth/verification/${id}/update/`, { status: decision, verification_notes: notes[id] || '' });
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vérification des formateurs" subtitle="Contrôlez les justificatifs avant d'autoriser la publication de cours." />
      <Tabs value={status} onChange={setStatus} items={[
        { value: 'PENDING', label: 'En attente' }, { value: 'NEEDS_MORE_INFO', label: 'Infos demandées' },
        { value: 'APPROVED', label: 'Approuvées' }, { value: 'REJECTED', label: 'Refusées' },
      ]} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : !data?.length ? <EmptyState title="Aucune demande" text="Les nouvelles demandes apparaîtront ici." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((v: any) => {
            const st = VERIF_STATUS[v.status] || VERIF_STATUS.PENDING;
            const open = ['PENDING', 'NEEDS_MORE_INFO', 'UNDER_REVIEW'].includes(v.status);
            return (
              <article key={v.id} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar name={v.user.full_name} src={v.user.avatar_url} size="w-11 h-11" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{v.user.full_name}</p>
                    <p className="text-sm text-gray-500 truncate">{v.user.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Demande du {new Date(v.created_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {v.id_document && (
                    <button onClick={() => downloadFile(`/auth/verification/${v.id}/document/id_document/`, 'piece-identite')} className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 hover:bg-gray-100">
                      <FileText className="w-4 h-4 text-primary-600" />Pièce d'identité
                    </button>
                  )}
                  {v.professional_cv && (
                    <button onClick={() => downloadFile(`/auth/verification/${v.id}/document/professional_cv/`, 'cv')} className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 hover:bg-gray-100">
                      <FileText className="w-4 h-4 text-primary-600" />CV
                    </button>
                  )}
                  {v.portfolio_url && <a href={v.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-semibold px-3 py-2 rounded-xl text-primary-700 hover:bg-primary-50">Portfolio ↗</a>}
                </div>
                {open ? (
                  <>
                    <input className={inputClass} placeholder="Note pour le formateur (obligatoire en cas de refus)" value={notes[v.id] || ''} onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })} />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => decide(v.id, 'APPROVED')} className={`${buttonPrimary} flex items-center gap-2`}><ShieldCheck className="w-4 h-4" />Approuver</button>
                      <button onClick={() => decide(v.id, 'NEEDS_MORE_INFO')} className={`${buttonSecondary} flex items-center gap-2`}><HelpCircle className="w-4 h-4" />Demander des infos</button>
                      <button onClick={() => (notes[v.id] ? decide(v.id, 'REJECTED') : alert('Indiquez le motif du refus dans la note.'))}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50"><ShieldX className="w-4 h-4" />Refuser</button>
                    </div>
                  </>
                ) : v.verification_notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">Note : {v.verification_notes}</p>}
              </article>
            );
          })}
        </div>
      )}
      <p className="text-sm text-gray-500">
        La modération des avis et des cours est également disponible dans l'<a className="text-primary-700 font-semibold hover:underline" href={`${backendBase}/admin/`} target="_blank" rel="noreferrer">administration Django</a>.
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ Paiements */
const PAY_STATUS: Record<string, 'secondary' | 'sun' | 'danger' | 'rose' | 'gray'> = {
  COMPLETED: 'secondary', PENDING: 'sun', PROCESSING: 'sun', FAILED: 'danger', REFUNDED: 'rose', CANCELLED: 'gray',
};

export const AdminPayments: React.FC = () => {
  const { query } = useLocation();
  const tab = query.get('tab') === 'payouts' ? 'payouts' : 'payments';
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const payments = useApi(async () => (tab === 'payments' ? api.get('/payments/admin/payments/', { status, search }) : null), [tab, status, search]);

  const refund = async (id: string) => {
    const reason = prompt('Motif du remboursement ?');
    if (reason === null) return;
    try {
      await api.post(`/payments/admin/payments/${id}/refund/`, { reason });
      payments.reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader title="Paiements" subtitle="Transactions et reversements aux formateurs" action={
        <button onClick={() => downloadFile('/analytics/export/payments/', 'paiements.csv')} className={`${buttonSecondary} flex items-center gap-2`}><Download className="w-4 h-4" />Exporter (CSV)</button>
      } />
      <Tabs value={tab} onChange={(v) => navigate(v === 'payouts' ? '/payments?tab=payouts' : '/payments')} items={[
        { value: 'payments', label: 'Transactions', icon: CreditCard }, { value: 'payouts', label: 'Versements formateurs', icon: Wallet },
      ]} />

      {tab === 'payments' ? (
        <Section padded={false}>
          <div className="flex flex-col sm:flex-row gap-3 px-5 pt-5">
            <SearchInput value={search} onChange={setSearch} placeholder="Référence ou email" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} sm:w-52`} aria-label="Statut">
              <option value="">Tous les statuts</option>
              <option value="COMPLETED">Réussis</option>
              <option value="PENDING">En attente</option>
              <option value="FAILED">Échoués</option>
              <option value="REFUNDED">Remboursés</option>
              <option value="CANCELLED">Annulés</option>
            </select>
          </div>
          {payments.error && <div className="p-5"><ErrorBox message={payments.error} /></div>}
          {payments.loading ? <Spinner className="h-60" /> : (
            <Table head={['Référence', 'Client', 'Objet', 'Montant', 'Moyen', 'Statut', '']}
              empty={!unwrap(payments.data || []).length && <p className="p-10 text-center text-gray-500">Aucune transaction.</p>}>
              {unwrap(payments.data || []).map((raw: any) => {
                const p = mapPayment(raw);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <Td><p className="font-mono font-semibold text-gray-900">{p.reference}</p><p className="text-xs text-gray-400">{p.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p></Td>
                    <Td><p className="font-semibold text-gray-900">{p.user?.name}</p><p className="text-gray-500">{p.user?.email}</p></Td>
                    <Td className="max-w-[16rem]"><p className="truncate text-gray-700">{p.description}</p></Td>
                    <Td className="font-bold text-gray-900 whitespace-nowrap tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
                    <Td className="whitespace-nowrap">{p.gatewayDisplay}{p.isSandbox && <Badge tone="gray" className="ml-2">test</Badge>}</Td>
                    <Td><Badge tone={PAY_STATUS[p.status] || 'gray'}>{p.statusDisplay}</Badge></Td>
                    <Td className="text-right">
                      {p.status === 'COMPLETED' && <button onClick={() => refund(p.id)} className="text-sm font-semibold text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">Rembourser</button>}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Section>
      ) : (
        <AdminPayoutRequests />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Analytiques */
export const AdminAnalytics: React.FC = () => (
  <div className="space-y-6">
    <PageHeader title="Analytiques & exports" subtitle="Téléchargez les données de la plateforme (compatible Excel)." />
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { label: 'Utilisateurs', path: '/analytics/export/users/', file: 'utilisateurs.csv', icon: Users, tone: 'bg-primary-50 text-primary-700' },
        { label: 'Inscriptions', path: '/analytics/export/enrollments/', file: 'inscriptions.csv', icon: BarChart3, tone: 'bg-secondary-50 text-secondary-700' },
        { label: 'Paiements', path: '/analytics/export/payments/', file: 'paiements.csv', icon: CreditCard, tone: 'bg-sun-50 text-sun-700' },
      ].map((e) => (
        <button key={e.label} onClick={() => downloadFile(e.path, e.file)} className="group text-left bg-white rounded-2xl ring-1 ring-gray-100 shadow-card p-5 hover:shadow-lift transition-shadow">
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${e.tone}`}><e.icon className="w-5 h-5" /></span>
          <p className="mt-4 font-bold text-gray-900">{e.label}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5 group-hover:text-primary-700"><Download className="w-4 h-4" />Télécharger le CSV</p>
        </button>
      ))}
    </div>
    <Section title="Indicateurs">
      <p className="text-gray-600">Les KPI (chiffre d'affaires mensuel, inscriptions, utilisateurs actifs) sont sur le <button className="text-primary-700 font-semibold hover:underline" onClick={() => navigate('/')}>tableau de bord</button>. Le monitoring technique est disponible dans Grafana (voir README).</p>
    </Section>
  </div>
);
