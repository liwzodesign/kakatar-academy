import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokens } from '../lib/api';
import type { User } from '../types';

interface AuthResponse {
  user: User;
  tokens: { access: string; refresh: string };
}

export interface RegisterData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  phone_number?: string;
  role?: 'ETUDIANT' | 'FORMATEUR';
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokens.access && !tokens.refresh) {
      setUser(null);
      return;
    }
    try {
      setUser(await api<User>('/auth/profile/'));
    } catch {
      tokens.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const handleAuth = (res: AuthResponse) => {
    tokens.set(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
    return res.user;
  };

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    login: async (email, password) =>
      handleAuth(await api<AuthResponse>('/auth/login/', { body: { email, password } })),
    register: async (data) =>
      handleAuth(await api<AuthResponse>('/auth/register/', { body: data })),
    logout: async () => {
      const refresh = tokens.refresh;
      try {
        if (refresh) await api('/auth/logout/', { body: { refresh_token: refresh } });
      } catch { /* déconnexion locale quoi qu'il arrive */ }
      tokens.clear();
      setUser(null);
    },
    refreshUser,
  }), [user, loading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

export const canTeach = (user: User | null) =>
  !!user && (user.role === 'ADMIN' || (user.role === 'FORMATEUR' && user.verification_status === 'VERIFIED'));
