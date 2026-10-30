import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBox, Field } from '../components/ui';
import { api } from '../lib/api';

function useNext() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('suite') || '/mon-apprentissage';
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <Card title="Connexion">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(''); setLoading(true);
          try { await login(form.email, form.password); navigate(next, { replace: true }); }
          catch (err) { setError((err as Error).message); }
          finally { setLoading(false); }
        }}
      >
        {error && <ErrorBox error={error} />}
        <Field label="Email" type="email" autoComplete="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Mot de passe" type="password" autoComplete="current-password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" loading={loading} className="w-full">Se connecter</Button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link to="/mot-de-passe-oublie" className="text-gray-600 hover:underline">Mot de passe oublié ?</Link>
        <Link to={`/inscription?suite=${encodeURIComponent(next)}`} className="font-medium text-brand-700 hover:underline">Créer un compte</Link>
      </div>
    </Card>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone_number: '', password: '', password_confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card title="Créer un compte">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(''); setLoading(true);
          try {
            const data = { ...form, phone_number: form.phone_number.replace(/\s/g, '') };
            await register(data);
            navigate(next, { replace: true });
          } catch (err) { setError((err as Error).message); }
          finally { setLoading(false); }
        }}
      >
        {error && <ErrorBox error={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" required autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
          <Field label="Nom" required autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
        </div>
        <Field label="Email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        <Field label="Téléphone (facultatif)" type="tel" placeholder="+221 77 000 00 00" autoComplete="tel"
          value={form.phone_number} onChange={set('phone_number')} />
        <Field label="Mot de passe (8 caractères min.)" type="password" required minLength={8} autoComplete="new-password"
          value={form.password} onChange={set('password')} />
        <Field label="Confirmer le mot de passe" type="password" required autoComplete="new-password"
          value={form.password_confirm} onChange={set('password_confirm')} />
        <Button type="submit" loading={loading} className="w-full">Créer mon compte</Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà inscrit ? <Link to={`/connexion?suite=${encodeURIComponent(next)}`} className="font-medium text-brand-700 hover:underline">Se connecter</Link>
      </p>
    </Card>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card title="Mot de passe oublié">
      {sent ? (
        <p className="text-gray-700">Si un compte existe pour <strong>{email}</strong>, un email avec un lien de réinitialisation vient d'être envoyé.</p>
      ) : (
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setLoading(true); setError('');
          try { await api('/auth/password/reset/', { body: { email } }); setSent(true); }
          catch (err) { setError((err as Error).message); }
          finally { setLoading(false); }
        }}>
          {error && <ErrorBox error={error} />}
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading} className="w-full">Envoyer le lien</Button>
        </form>
      )}
    </Card>
  );
}

export function ResetPassword() {
  const params = new URLSearchParams(useLocation().search);
  const navigate = useNavigate();
  const [pw, setPw] = useState({ new_password: '', new_password_confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card title="Nouveau mot de passe">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
          await api('/auth/password/reset/confirm/', {
            body: { uid: params.get('uid'), token: params.get('token'), ...pw },
          });
          navigate('/connexion', { replace: true });
        } catch (err) { setError((err as Error).message); }
        finally { setLoading(false); }
      }}>
        {error && <ErrorBox error={error} />}
        <Field label="Nouveau mot de passe" type="password" required minLength={8} value={pw.new_password}
          onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
        <Field label="Confirmer" type="password" required value={pw.new_password_confirm}
          onChange={(e) => setPw({ ...pw, new_password_confirm: e.target.value })} />
        <Button type="submit" loading={loading} className="w-full">Enregistrer</Button>
      </form>
    </Card>
  );
}
