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
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentView, onViewChange }) => {
  const { authState } = useAuth();
  const userRole = authState.user?.role;

  const getMenuItems = () => {
    const commonItems = [
      { id: 'dashboard', label: 'Tableau de bord', icon: Home }
    ];

    if (userRole === 'ETUDIANT') {
      return [
        ...commonItems,
        { id: 'catalog', label: 'Catalogue', icon: BookOpen },
        { id: 'my-courses', label: 'Mes cours', icon: GraduationCap },
        { id: 'sessions', label: 'Sessions', icon: Calendar },
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag }
      ];
    }

    if (userRole === 'FORMATEUR') {
      return [
        ...commonItems,
        { id: 'my-courses', label: 'Mes cours', icon: BookOpen },
        { id: 'create-course', label: 'Créer un cours', icon: Plus },
        { id: 'students', label: 'Étudiants', icon: Users },
        { id: 'sessions', label: 'Sessions', icon: Calendar },
        { id: 'analytics', label: 'Analytiques', icon: BarChart3 }
      ];
    }

    if (userRole === 'ADMIN') {
      return [
        ...commonItems,
        { id: 'courses', label: 'Gestion cours', icon: BookOpen },
        { id: 'users', label: 'Utilisateurs', icon: Users },
        { id: 'sessions', label: 'Sessions', icon: Calendar },
        { id: 'moderation', label: 'Modération', icon: Shield },
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
        { id: 'analytics', label: 'Analytiques', icon: BarChart3 }
      ];
    }

    return commonItems;
  };

  const menuItems = getMenuItems();
  const bottomItems = [
    { id: 'support', label: 'Support', icon: HelpCircle },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  const MenuItem: React.FC<{ 
    item: { id: string; label: string; icon: any }; 
    isActive: boolean;
    onClick: () => void;
  }> = ({ item, isActive, onClick }) => {
    const Icon = item.icon;
    
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
        <span className="font-medium">{item.label}</span>
      </motion.button>
    );
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 lg:static lg:inset-0`}>
      <div className="h-full flex flex-col">
        {/* Header avec rôle utilisateur */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{authState.user?.name}</p>
              <p className="text-xs text-gray-500">
                {userRole === 'ETUDIANT' && 'Espace étudiant'}
                {userRole === 'FORMATEUR' && 'Studio formateur'}
                {userRole === 'ADMIN' && 'Administration'}
              </p>
            </div>
          </div>
        </div>

        {/* Menu principal */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              isActive={currentView === item.id}
              onClick={() => onViewChange(item.id)}
            />
          ))}
        </nav>

        {/* Menu du bas */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {bottomItems.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              isActive={currentView === item.id}
              onClick={() => onViewChange(item.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};