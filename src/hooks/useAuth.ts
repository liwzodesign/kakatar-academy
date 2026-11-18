import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, tokens } from '../lib/api';
import { mapUser } from '../lib/mappers';
import { AuthState, User } from '../types';
import { clearReferralCode, storedReferralCode } from '../components/Account/Referral';

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: 'ETUDIANT' | 'FORMATEUR';
}

interface LoginResult {
  ok: boolean;
  otpRequired?: boolean;
  error?: string;
}

interface AuthContextValue {
  authState: AuthState;
  login: (email: string, password: string, otpCode?: string) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: !!tokens.access,
  });

  const setUser = (user: User | null) =>
    setAuthState({ user, isAuthenticated: !!user, loading: false });

  const refreshUser = useCallback(async () => {
    if (!tokens.access) return setUser(null);
    try {
      setUser(mapUser(await api.get('/auth/profile/')));
    } catch {
      tokens.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    const onLogout = () => setUser(null);
    window.addEventListener('kakatar:logout', onLogout);
    return () => window.removeEventListener('kakatar:logout', onLogout);
  }, [refreshUser]);

  const login = async (email: string, password: string, otpCode?: string): Promise<LoginResult> => {
    try {
      const data = await api.post('/auth/login/', { email, password, otp_code: otpCode || undefined });
      tokens.set(data.tokens.access, data.tokens.refresh);
      setUser(mapUser(data.user));
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.data?.otp_required) return { ok: false, otpRequired: true };
      return { ok: false, error: err instanceof ApiError && err.status === 400
        ? (err.data?.otp_code ? 'Code 2FA invalide' : 'Email ou mot de passe incorrect')
        : (err as Error).message };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await api.post('/auth/register/', {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        password: data.password,
        password_confirm: data.password,
        role: data.role || 'ETUDIANT',
        referral_code: storedReferralCode() || undefined,
      });
      clearReferralCode();
      tokens.set(res.tokens.access, res.tokens.refresh);
      setUser(mapUser(res.user));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  };

  const logout = () => {
    const refresh = tokens.refresh;
    if (refresh) api.post('/auth/logout/', { refresh }).catch(() => undefined);
    tokens.clear();
    setUser(null);
  };

  const updateUser = (user: User) => setAuthState((prev) => ({ ...prev, user }));

  return createElement(
    AuthContext.Provider,
    { value: { authState, login, register, logout, refreshUser, updateUser } },
    children
  );
};
