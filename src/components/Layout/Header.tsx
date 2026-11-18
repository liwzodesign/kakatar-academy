import React, { useEffect, useRef, useState } from 'react';
import { Menu, Search, User, LogOut, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { navigate, useLocation } from '../../lib/router';
import { NotificationBell } from './NotificationBell';
import { Logo } from '../UI/Logo';
import { Avatar } from '../UI';

interface HeaderProps {
  onMenuToggle: () => void;
  onSearch?: (term: string) => void;
  onLogin?: () => void;
  onRegister?: () => void;
}

const ROLE_LABELS: Record<string, [string, string]> = {
  ETUDIANT: ['Étudiant', 'bg-primary-50 text-primary-700'],
  FORMATEUR: ['Formateur', 'bg-secondary-50 text-secondary-700'],
  ADMIN: ['Administrateur', 'bg-sun-100 text-sun-800'],
  MODERATEUR: ['Modérateur', 'bg-gray-100 text-gray-700'],
  PARTENAIRE: ['Partenaire', 'bg-gray-100 text-gray-700'],
};

const PUBLIC_LINKS = [
  { path: '/catalog', label: 'Cours' },
  { path: '/paths', label: 'Parcours' },
  { path: '/sessions', label: 'Sessions en direct' },
  { path: '/marketplace', label: 'Ressources' },
];

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onSearch, onLogin, onRegister }) => {
  const { authState, logout } = useAuth();
  const { path } = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const user = authState.user;

  // Raccourci « / » ou Ctrl/⌘+K pour rechercher
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setMobileSearch(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isProfileOpen) return;
    const close = (e: MouseEvent) => profileRef.current && !profileRef.current.contains(e.target as Node) && setIsProfileOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isProfileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    onSearch?.(searchTerm.trim());
    setMobileSearch(false);
    searchRef.current?.blur();
  };

  const go = (to: string) => {
    navigate(to);
    setIsProfileOpen(false);
  };

  const searchForm = (
    <form onSubmit={handleSearch} role="search" className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        ref={searchRef}
        type="search"
        aria-label="Rechercher un cours ou un formateur"
        placeholder="Rechercher un cours, un formateur…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-14 py-2.5 bg-gray-100 border border-transparent rounded-xl text-sm placeholder-gray-500 focus:bg-white focus:border-primary-200 focus:ring-4 focus:ring-primary-100 outline-none transition"
      />
      <kbd className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 items-center text-[11px] font-medium text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">
        Ctrl K
      </kbd>
    </form>
  );

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-40">
      <div className="container-page">
        <div className="flex items-center h-16 gap-4">
          {authState.isAuthenticated && (
            <button onClick={onMenuToggle} aria-label="Ouvrir le menu" className="lg:hidden -ml-2 p-2 rounded-lg hover:bg-gray-100">
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          )}

          <button onClick={() => navigate('/')} aria-label="Accueil Kakatar Academy" className={`flex-shrink-0 ${authState.isAuthenticated ? 'lg:hidden' : ''}`}>
            <Logo className="h-9 sm:h-10" />
          </button>

          {!authState.isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Navigation principale">
              {PUBLIC_LINKS.map((l) => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${path.startsWith(l.path) ? 'text-primary-700 bg-primary-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                  {l.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex-1 max-w-xl mx-auto hidden sm:block">{searchForm}</div>
          <div className="flex-1 sm:hidden" />

          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setMobileSearch(true)} aria-label="Rechercher" className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <Search className="w-5 h-5" />
            </button>

            {authState.isAuthenticated && user ? (
              <>
                <NotificationBell />
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    aria-haspopup="menu"
                    aria-expanded={isProfileOpen}
                    className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <Avatar name={user.name} src={user.avatar} size="w-9 h-9" />
                    <span className="hidden md:block text-left leading-tight">
                      <span className="block text-sm font-semibold text-gray-900 max-w-[10rem] truncate">{user.name}</span>
                      <span className={`inline-block mt-0.5 px-1.5 rounded text-[11px] font-semibold ${ROLE_LABELS[user.role]?.[1] || ''}`}>
                        {ROLE_LABELS[user.role]?.[0] || user.role}
                      </span>
                    </span>
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, scale: 0.97, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lift border border-gray-100 p-2"
                      >
                        <div className="px-3 py-2.5 mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <button role="menuitem" onClick={() => go('/settings')} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                          <User className="w-4 h-4 text-gray-400" /> Mon profil
                        </button>
                        <button role="menuitem" onClick={() => go('/settings?tab=security')} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                          <Settings className="w-4 h-4 text-gray-400" /> Paramètres & sécurité
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          role="menuitem"
                          onClick={() => { logout(); go('/'); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                        >
                          <LogOut className="w-4 h-4" /> Se déconnecter
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <button onClick={onLogin} className="hidden sm:block px-3 py-2 text-sm font-semibold text-gray-700 hover:text-primary-700 rounded-lg">
                  Se connecter
                </button>
                <button onClick={onLogin} className="sm:hidden bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                  Connexion
                </button>
                <button onClick={onRegister} className="hidden sm:block bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-800 shadow-sm transition-colors">
                  Commencer gratuitement
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recherche plein écran sur mobile */}
      <AnimatePresence>
        {mobileSearch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sm:hidden absolute inset-x-0 top-0 h-16 bg-white flex items-center gap-2 px-4 border-b">
            {searchForm}
            <button onClick={() => setMobileSearch(false)} aria-label="Fermer la recherche" className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
