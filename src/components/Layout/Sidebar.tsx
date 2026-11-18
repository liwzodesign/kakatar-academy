import React from 'react';
import {
  Home,
  BookOpen,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  GraduationCap,
  ShoppingBag,
  HelpCircle,
  Shield,
  Award,
  CreditCard,
  Package,
  ClipboardCheck,
  Tag,
  Route,
  Brain,
  Download,
  UsersRound,
} from 'lucide-react';
import { Logo } from '../UI/Logo';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
}

type Item = { path: string; label: string; icon: React.ElementType };

const MENUS: Record<string, Item[]> = {
  ETUDIANT: [
    { path: '/catalog', label: 'Catalogue', icon: BookOpen },
    { path: '/my-courses', label: 'Mes cours', icon: GraduationCap },
    { path: '/reviews', label: 'Révisions', icon: Brain },
    { path: '/paths', label: 'Parcours', icon: Route },
    { path: '/downloads', label: 'Téléchargements', icon: Download },
    { path: '/sessions', label: 'Sessions', icon: Calendar },
    { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { path: '/purchases', label: 'Mes achats', icon: Package },
    { path: '/certificates', label: 'Certificats', icon: Award },
  ],
  FORMATEUR: [
    { path: '/my-courses', label: 'Mes cours', icon: BookOpen },
    { path: '/create-course', label: 'Créer un cours', icon: Plus },
    { path: '/students', label: 'Étudiants', icon: Users },
    { path: '/assignments', label: 'Corrections', icon: ClipboardCheck },
    { path: '/my-paths', label: 'Parcours', icon: Route },
    { path: '/my-cohorts', label: 'Promotions', icon: UsersRound },
    { path: '/my-coupons', label: 'Codes promo', icon: Tag },
    { path: '/sessions', label: 'Sessions', icon: Calendar },
    { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { path: '/analytics', label: 'Revenus & stats', icon: BarChart3 },
    { path: '/catalog', label: 'Catalogue', icon: GraduationCap },
  ],
  ADMIN: [
    { path: '/catalog', label: 'Cours', icon: BookOpen },
    { path: '/users', label: 'Utilisateurs', icon: Users },
    { path: '/moderation', label: 'Vérifications', icon: Shield },
    { path: '/payments', label: 'Paiements', icon: CreditCard },
    { path: '/coupons', label: 'Codes promo', icon: Tag },
    { path: '/sessions', label: 'Sessions', icon: Calendar },
    { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { path: '/analytics', label: 'Analytiques', icon: BarChart3 },
  ],
};

const BOTTOM: Item[] = [
  { path: '/support', label: 'Support', icon: HelpCircle },
  { path: '/settings', label: 'Paramètres', icon: Settings },
];

const MenuItem: React.FC<{ item: Item; isActive: boolean; onClick: () => void }> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-xl text-sm font-medium transition-colors ${
        isActive ? 'bg-primary-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-secondary-300' : 'text-gray-400 group-hover:text-gray-600'}`} />
      <span>{item.label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentPath, onNavigate }) => {
  const { authState } = useAuth();
  const role = authState.user?.role || 'ETUDIANT';
  const items: Item[] = [{ path: '/', label: 'Tableau de bord', icon: Home }, ...(MENUS[role] || MENUS.ETUDIANT)];
  const isActive = (path: string) => (path === '/' ? currentPath === '/' : currentPath.startsWith(path));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen`}
    >
      <div className="h-full flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-gray-100">
          <button onClick={() => onNavigate('/')} aria-label="Accueil"><Logo className="h-9" /></button>
        </div>
        <div className="px-5 pt-5 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {role === 'ETUDIANT' && 'Espace étudiant'}
            {role === 'FORMATEUR' && 'Studio formateur'}
            {role === 'ADMIN' && 'Administration'}
          </p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Menu">
          {items.map((item) => (
            <MenuItem key={item.path} item={item} isActive={isActive(item.path)} onClick={() => onNavigate(item.path)} />
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100 space-y-1">
          {BOTTOM.map((item) => (
            <MenuItem key={item.path} item={item} isActive={isActive(item.path)} onClick={() => onNavigate(item.path)} />
          ))}
        </div>
      </div>
    </aside>
  );
};
