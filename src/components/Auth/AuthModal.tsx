import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  initialMode?: 'login' | 'register';
  initialRole?: 'ETUDIANT' | 'FORMATEUR';
}

const field =
  'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login', initialRole = 'ETUDIANT' }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: initialRole as 'ETUDIANT' | 'FORMATEUR',
  });
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const res = await api.post('/auth/password/reset/', { email: formData.email });
        setInfo(res.message);
      } else if (mode === 'login') {
        const result = await login(formData.email, formData.password, otpRequired ? otpCode : undefined);
        if (result.ok) onClose(true);
        else if (result.otpRequired) setOtpRequired(true);
        else setError(result.error || 'Connexion impossible');
      } else {
        const result = await register(formData);
        if (result.ok) onClose(true);
        else setError(result.error || "Erreur lors de l'inscription");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const titles = {
    login: ['Connexion', "Accédez à votre espace d'apprentissage"],
    register: ['Inscription', 'Rejoignez Kakatar Academy'],
    forgot: ['Mot de passe oublié', 'Recevez un lien de réinitialisation par email'],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm" onClick={() => onClose()}></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        role="dialog" aria-modal="true" className="relative bg-white rounded-3xl shadow-lift max-w-md w-full mx-4 p-8 max-h-[95vh] overflow-y-auto"
      >
        <button onClick={() => onClose()} aria-label="Fermer" className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <img src="/logo-mark.svg" alt="" className="h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">{titles[mode][0]}</h2>
          <p className="text-gray-600 mt-2">{titles[mode][1]}</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        {info && <div className="bg-secondary-50 text-secondary-700 p-3 rounded-lg mb-6 text-sm">{info}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="Prénom" value={formData.firstName} onChange={set('firstName')} className={field} required />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="Nom" value={formData.lastName} onChange={set('lastName')} className={field} required />
                </div>
              </div>
              <select value={formData.role} onChange={set('role')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="ETUDIANT">Je veux apprendre (étudiant)</option>
                <option value="FORMATEUR">Je veux enseigner (formateur)</option>
              </select>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="email" placeholder="Adresse email" value={formData.email} onChange={set('email')} className={field} required autoComplete="email" />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mot de passe"
                value={formData.password}
                onChange={set('password')}
                className={`${field} pr-12`}
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {mode === 'login' && otpRequired && (
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Code à 6 chiffres (application 2FA)"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={field}
                autoFocus
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <p className="text-xs text-gray-500">8 caractères minimum, pas uniquement des chiffres.</p>
          )}

          {mode === 'login' && import.meta.env.DEV && (
            <div className="text-xs text-gray-600 bg-primary-50 p-3 rounded-lg">
              <strong>Comptes de démo</strong> (après <code>python manage.py seed_demo</code>) :<br />
              marie@example.com · jean@example.com · admin@kakatar.com — mot de passe <code>password123</code>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-700 text-white py-3 rounded-xl font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Chargement...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? "S'inscrire" : 'Envoyer le lien'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          {mode === 'login' && (
            <button onClick={() => { setMode('forgot'); setError(''); }} className="block w-full text-sm text-gray-500 hover:text-gray-700">
              Mot de passe oublié ?
            </button>
          )}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setInfo('');
              setOtpRequired(false);
            }}
            className="text-primary-600 hover:text-primary-700 transition-colors"
          >
            {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
