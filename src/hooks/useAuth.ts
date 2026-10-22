import { useState, useContext, createContext, useEffect, createElement } from 'react';
import { User, AuthState } from '../types';

const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: any) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: false
  });

  useEffect(() => {
    // Simuler la récupération de l'état d'authentification depuis localStorage
    const savedUser = localStorage.getItem('kakatar_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setAuthState({ user, isAuthenticated: true, loading: false });
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    // Simulation API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock users pour démo
    const mockUsers: User[] = [
      { id: '1', name: 'Marie Dubois', email: 'marie@example.com', role: 'ETUDIANT', verified: true, createdAt: new Date() },
      { id: '2', name: 'Dr. Jean Martin', email: 'jean@example.com', role: 'FORMATEUR', verified: true, bio: 'Expert en développement web', createdAt: new Date() },
      { id: '3', name: 'Admin User', email: 'admin@kakatar.com', role: 'ADMIN', verified: true, createdAt: new Date() }
    ];

    const user = mockUsers.find(u => u.email === email);
    
    if (user && password === 'password123') {
      localStorage.setItem('kakatar_user', JSON.stringify(user));
      setAuthState({ user, isAuthenticated: true, loading: false });
      return true;
    }
    
    setAuthState(prev => ({ ...prev, loading: false }));
    return false;
  };

  const register = async (data: any): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    // Simulation API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newUser: User = {
      id: Date.now().toString(),
      name: `${data.firstName} ${data.lastName}`,
      email: data.email,
      role: data.role || 'ETUDIANT',
      verified: false,
      createdAt: new Date()
    };

    localStorage.setItem('kakatar_user', JSON.stringify(newUser));
    setAuthState({ user: newUser, isAuthenticated: true, loading: false });
    return true;
  };

  const logout = () => {
    localStorage.removeItem('kakatar_user');
    setAuthState({ user: null, isAuthenticated: false, loading: false });
  };

  const updateUser = (user: User) => {
    localStorage.setItem('kakatar_user', JSON.stringify(user));
    setAuthState(prev => ({ ...prev, user }));
  };

  return createElement(
    AuthContext.Provider,
    { value: { authState, login, register, logout, updateUser } },
    children
  );
};