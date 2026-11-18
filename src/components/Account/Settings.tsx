import React, { useEffect, useState } from 'react';
import { User as UserIcon, Lock, ShieldCheck, FileCheck, Crown, Gift, Globe } from 'lucide-react';
import { api, request } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { mapUser } from '../../lib/mappers';
import { navigate, useLocation } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, Card, ErrorBox, PageHeader, Spinner, SuccessBox, buttonPrimary, buttonSecondary, inputClass } from '../UI';
import { Field, FileDrop, Tabs } from '../UI/kit';
import { CheckoutModal } from '../Payment/CheckoutModal';
import { ReferralTab } from './Referral';
import { PublicProfileTab } from '../Learning/PublicProfile';

const Feedback: React.FC<{ ok?: string; err?: string }> = ({ ok, err }) => (
  <>{ok && <SuccessBox message={ok} />}{err && <ErrorBox message={err} />}</>
);

const ProfileTab: React.FC = () => {
  const { authState, updateUser } = useAuth();
  const u = authState.user!;
  const [form, setForm] = useState({
    first_name: u.firstName, last_name: u.lastName, bio: u.bio || '', phone_number: u.phone || '', country: u.country || '', email_notifications: u.emailNotifications !== false,
    city: u.city || '', company: u.company || '', website: u.website || '', linkedin: u.linkedin || '',
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ ok: '', err: '' });
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      if (avatar) body.append('avatar', avatar);
      updateUser(mapUser(await request('/auth/profile/', { method: 'PATCH', body })));
      setMsg({ ok: 'Profil mis à jour', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: (err as Error).message });
    }
  };

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar name={u.name} src={u.avatar} size="w-20 h-20" />
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900">{u.name}</p>
          <p className="text-sm text-gray-500">{u.email}</p>
        </div>
        <div className="sm:w-80">
          <FileDrop accept="image/*" image file={avatar} onChange={setAvatar} label="Changer la photo" hint="JPG ou PNG, carré de préférence." />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Prénom" required><input className={inputClass} value={form.first_name} onChange={set('first_name')} required /></Field>
        <Field label="Nom" required><input className={inputClass} value={form.last_name} onChange={set('last_name')} required /></Field>
        <Field label="Email" hint="Contactez le support pour changer d'adresse email." className="md:col-span-2">
          <input className={`${inputClass} bg-gray-50 text-gray-500`} value={u.email} disabled />
        </Field>
        <Field label="Biographie" hint={`${form.bio.length}/500 — visible sur vos cours si vous êtes formateur.`} className="md:col-span-2">
          <textarea className={inputClass} rows={3} maxLength={500} value={form.bio} onChange={set('bio')} />
        </Field>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">Coordonnées</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Téléphone"><input className={inputClass} value={form.phone_number} onChange={set('phone_number')} placeholder="+221 77 000 00 00" inputMode="tel" /></Field>
          <Field label="Pays"><input className={inputClass} value={form.country} onChange={set('country')} /></Field>
          <Field label="Ville"><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">Professionnel</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Entreprise"><input className={inputClass} value={form.company} onChange={set('company')} /></Field>
          <Field label="Site web"><input className={inputClass} value={form.website} onChange={set('website')} placeholder="https://" inputMode="url" /></Field>
          <Field label="LinkedIn"><input className={inputClass} value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/…" inputMode="url" /></Field>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">Notifications</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4 accent-primary-700" checked={form.email_notifications}
            onChange={(e) => setForm({ ...form, email_notifications: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Recevoir les annonces et rappels par email</span>
            <span className="block text-xs text-gray-500">Les emails importants (reçus de paiement, sécurité du compte) sont toujours envoyés.</span>
          </span>
        </label>
      </div>
      <Feedback {...msg} />
      <div className="flex justify-end border-t border-gray-100 pt-5">
        <button className={buttonPrimary}>Enregistrer les modifications</button>
      </div>
    </form>
  );
};

const SecurityTab: React.FC = () => {
  const { authState, refreshUser } = useAuth();
  const [pwd, setPwd] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ ok: '', err: '' });
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [tfaMsg, setTfaMsg] = useState({ ok: '', err: '' });
  const enabled = authState.user?.twoFactorEnabled;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/password/change/', pwd);
      setPwdMsg({ ok: 'Mot de passe modifié', err: '' });
      setPwd({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (err) {
      setPwdMsg({ ok: '', err: (err as Error).message });
    }
  };

  const startSetup = async () => {
    try {
      setSetup(await api.post('/auth/two-factor/setup/'));
    } catch (err) {
      setTfaMsg({ ok: '', err: (err as Error).message });
    }
  };

  const toggle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/two-factor/toggle/', { code });
      setTfaMsg({ ok: res.message, err: '' });
      setSetup(null);
      setCode('');
      refreshUser();
    } catch (err) {
      setTfaMsg({ ok: '', err: (err as Error).message });
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={changePassword} className="space-y-3 max-w-md">
        <h3 className="font-semibold text-gray-900">Changer de mot de passe</h3>
        <input type="password" className={inputClass} placeholder="Mot de passe actuel" value={pwd.old_password} onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} required />
        <input type="password" className={inputClass} placeholder="Nouveau mot de passe" minLength={8} value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} required />
        <input type="password" className={inputClass} placeholder="Confirmer" value={pwd.new_password_confirm} onChange={(e) => setPwd({ ...pwd, new_password_confirm: e.target.value })} required />
        <Feedback {...pwdMsg} />
        <button className={buttonPrimary}>Modifier</button>
      </form>

      <div className="space-y-3 max-w-md">
        <h3 className="font-semibold text-gray-900">Authentification à deux facteurs</h3>
        <p className="text-sm text-gray-600">Statut : <strong>{enabled ? 'activée' : 'désactivée'}</strong>. Utilisez Google Authenticator, Authy ou Microsoft Authenticator.</p>
        {!enabled && !setup && <button onClick={startSetup} className={buttonSecondary}>Activer la 2FA</button>}
        {setup && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
            <p>1. Dans votre application, ajoutez un compte avec cette clé :</p>
            <p className="font-mono bg-white border rounded p-2 break-all select-all">{setup.secret}</p>
            <p>Sur mobile, vous pouvez aussi <a className="text-primary-700 font-semibold hover:underline" href={setup.otpauth_uri}>ouvrir directement l'application</a>.</p>
            <p>2. Saisissez le code à 6 chiffres affiché :</p>
          </div>
        )}
        {(setup || enabled) && (
          <form onSubmit={toggle} className="flex space-x-2">
            <input className={inputClass} inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <button className={enabled ? buttonSecondary : buttonPrimary}>{enabled ? 'Désactiver' : 'Confirmer'}</button>
          </form>
        )}
        <Feedback {...tfaMsg} />
      </div>
    </div>
  );
};

const VerificationTab: React.FC = () => {
  const { authState } = useAuth();
  const { data, loading, reload } = useApi(() => api.get('/auth/verification/detail/').catch(() => null), []);
  const [files, setFiles] = useState<{ id?: File; cv?: File }>({});
  const [portfolio, setPortfolio] = useState('');
  const [msg, setMsg] = useState({ ok: '', err: '' });

  if (loading) return <Spinner className="h-32" />;
  const status = authState.user?.verificationStatus;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.id || !files.cv) return setMsg({ ok: '', err: 'Les deux documents sont requis.' });
    const body = new FormData();
    body.append('id_document', files.id);
    body.append('professional_cv', files.cv);
    if (portfolio) body.append('portfolio_url', portfolio);
    try {
      await request('/auth/verification/', { method: 'POST', body });
      setMsg({ ok: 'Demande envoyée. Vous serez notifié par email.', err: '' });
      reload();
    } catch (err) {
      setMsg({ ok: '', err: (err as Error).message });
    }
  };

  if (status === 'VERIFIED') return <SuccessBox message="Votre compte formateur est vérifié : vous pouvez publier vos cours." />;
  const pending = data && ['PENDING', 'UNDER_REVIEW'].includes(data.status);

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-gray-600">Pour garantir la qualité des formations, chaque formateur est vérifié avant de pouvoir publier.</p>
      {pending ? <SuccessBox message="Votre demande est en cours d'examen." /> : (
        <form onSubmit={submit} className="space-y-3">
          {data?.status === 'REJECTED' && <ErrorBox message={`Demande précédente refusée${data.verification_notes ? ` : ${data.verification_notes}` : ''}. Vous pouvez en déposer une nouvelle.`} />}
          <Field label="Pièce d'identité" required><FileDrop accept=".pdf,image/*" file={files.id || null} onChange={(f) => setFiles({ ...files, id: f || undefined })} hint="PDF ou photo lisible." /></Field>
          <Field label="CV" required><FileDrop accept=".pdf,.doc,.docx" file={files.cv || null} onChange={(f) => setFiles({ ...files, cv: f || undefined })} hint="PDF ou Word." /></Field>
          <input className={inputClass} placeholder="Portfolio / LinkedIn (facultatif)" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
          <button className={buttonPrimary}>Envoyer ma demande</button>
        </form>
      )}
      <Feedback {...msg} />
    </div>
  );
};

export const SubscriptionTab: React.FC = () => {
  const { data, loading, reload } = useApi(async () => {
    const [cfg, sub] = await Promise.all([api.get('/payments/config/'), api.get('/payments/subscription/')]);
    return { plans: cfg.plans, active: sub.active };
  }, []);
  const [checkout, setCheckout] = useState<{ code: string; name: string; months: number; amount: number } | null>(null);
  const [msg, setMsg] = useState('');

  if (loading || !data) return <Spinner className="h-32" />;

  const cancel = async () => {
    const res = await api.post('/payments/subscription/cancel/');
    setMsg(res.message);
    reload();
  };

  return (
    <div className="space-y-6">
      {data.active ? (
        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 text-sm">
          Abonnement <strong>{data.active.plan_display}</strong> actif jusqu'au {new Date(data.active.end_date).toLocaleDateString('fr-FR')} ({data.active.days_remaining} jours).
          {data.active.auto_renew && <button onClick={cancel} className="ml-2 underline">Ne pas renouveler</button>}
        </div>
      ) : <p className="text-sm text-gray-600">L'abonnement donne accès à tous les cours marqués « Abonnement ».</p>}
      {msg && <SuccessBox message={msg} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.plans.map((p: any) => (
          <div key={p.code} className="border rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-gray-900">{p.name}</h3>
            <p className="text-2xl font-bold">{formatPrice(p.monthly_price)}<span className="text-sm font-normal text-gray-500"> / mois</span></p>
            <div className="flex flex-col gap-2">
              <button onClick={() => setCheckout({ code: p.code, name: p.name, months: 1, amount: p.monthly_price })} className={buttonPrimary}>1 mois</button>
              <button onClick={() => setCheckout({ code: p.code, name: p.name, months: 12, amount: Math.round(p.monthly_price * 12 * 0.8) })} className={buttonSecondary}>12 mois (-20 %)</button>
            </div>
          </div>
        ))}
      </div>
      {checkout && (
        <CheckoutModal title={`Abonnement ${checkout.name} — ${checkout.months} mois`} amount={checkout.amount} allowCoupon onClose={() => setCheckout(null)}
          startCheckout={(gateway, coupon_code) => api.post('/payments/checkout/', { gateway, plan: checkout.code, months: checkout.months, coupon_code })}
          onCompleted={reload} />
      )}
    </div>
  );
};

export const Settings: React.FC = () => {
  const { authState } = useAuth();
  const { query } = useLocation();
  const isInstructor = authState.user?.role === 'FORMATEUR';
  const tabs = [
    { id: 'profile', label: 'Profil', icon: UserIcon },
    { id: 'security', label: 'Sécurité', icon: Lock },
    ...(isInstructor ? [{ id: 'verification', label: 'Vérification', icon: FileCheck }] : []),
    { id: 'subscription', label: 'Abonnement', icon: Crown },
    { id: 'public', label: 'Profil public', icon: Globe },
    { id: 'referral', label: 'Parrainage', icon: Gift },
  ];
  const [tab, setTab] = useState(query.get('tab') || 'profile');
  useEffect(() => setTab(query.get('tab') || 'profile'), [query]);

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Votre compte, votre sécurité" />
      <Tabs value={tab} onChange={(v) => navigate(`/settings?tab=${v}`)} className="mb-6" items={tabs.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))} />
      <Card>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'verification' && <VerificationTab />}
        {tab === 'subscription' && <SubscriptionTab />}
        {tab === 'public' && <PublicProfileTab />}
        {tab === 'referral' && <ReferralTab />}
      </Card>
      <p className="text-xs text-gray-400 mt-4 flex items-center space-x-1"><ShieldCheck className="w-3 h-3" /><span>Vos données sont protégées et ne sont jamais revendues.</span></p>
    </div>
  );
};

export const ResetPassword: React.FC<{ uid: string; token: string }> = ({ uid, token }) => {
  const [pwd, setPwd] = useState({ new_password: '', new_password_confirm: '' });
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/password/reset/confirm/', { uid, token, ...pwd });
      setMsg({ ok: 'Mot de passe réinitialisé. Vous pouvez vous connecter.', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: (err as Error).message });
    }
  };
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <h1 className="text-xl font-extrabold text-gray-900 mb-4">Nouveau mot de passe</h1>
        {msg.ok ? <><SuccessBox message={msg.ok} /><button onClick={() => navigate('/')} className={`${buttonPrimary} mt-4`}>Se connecter</button></> : (
          <form onSubmit={submit} className="space-y-3">
            <input type="password" minLength={8} className={inputClass} placeholder="Nouveau mot de passe" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} required />
            <input type="password" className={inputClass} placeholder="Confirmer" value={pwd.new_password_confirm} onChange={(e) => setPwd({ ...pwd, new_password_confirm: e.target.value })} required />
            <Feedback {...msg} />
            <button className={`${buttonPrimary} w-full`}>Valider</button>
          </form>
        )}
      </Card>
    </div>
  );
};
