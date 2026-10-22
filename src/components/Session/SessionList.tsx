import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Filter, 
  Search,
  User,
  Star,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Session {
  id: string;
  title: string;
  description: string;
  date: Date;
  duration: number;
  location: string;
  capacity: number;
  registrations: number;
  price: number;
  instructor: {
    name: string;
    avatar?: string;
    rating: number;
  };
  type: 'ONLINE' | 'PRESENTIAL';
  category: string;
  level: 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';
}

interface SessionListProps {
  onSessionSelect: (session: Session) => void;
}

export const SessionList: React.FC<SessionListProps> = ({ onSessionSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Mock data
  const mockSessions: Session[] = [
    {
      id: '1',
      title: 'Workshop React Avancé',
      description: 'Approfondissez vos connaissances React avec les hooks avancés, le state management et les patterns modernes.',
      date: new Date('2024-12-15T14:00:00'),
      duration: 180,
      location: 'Dakar, Sénégal - Centre de formation Kakatar',
      capacity: 20,
      registrations: 12,
      price: 25000,
      instructor: {
        name: 'Dr. Jean Martin',
        rating: 4.9
      },
      type: 'PRESENTIAL',
      category: 'Développement Web',
      level: 'AVANCE'
    },
    {
      id: '2',
      title: 'Introduction à la Data Science',
      description: 'Découvrez les fondamentaux de la science des données avec Python, pandas et matplotlib.',
      date: new Date('2024-12-18T10:00:00'),
      duration: 240,
      location: 'Session en ligne via Zoom',
      capacity: 50,
      registrations: 35,
      price: 20000,
      instructor: {
        name: 'Sarah Chen',
        rating: 4.8
      },
      type: 'ONLINE',
      category: 'Data Science',
      level: 'DEBUTANT'
    },
    {
      id: '3',
      title: 'Atelier UX Design Thinking',
      description: 'Maîtrisez les méthodes de design thinking pour créer des expériences utilisateur exceptionnelles.',
      date: new Date('2024-12-20T16:00:00'),
      duration: 150,
      location: 'Abidjan, Côte d\'Ivoire - Hub Innovation',
      capacity: 15,
      registrations: 8,
      price: 30000,
      instructor: {
        name: 'Ahmed Okafor',
        rating: 4.7
      },
      type: 'PRESENTIAL',
      category: 'Design',
      level: 'INTERMEDIAIRE'
    },
    {
      id: '4',
      title: 'Marketing Digital & SEO',
      description: 'Stratégies complètes pour optimiser votre présence en ligne et améliorer votre référencement.',
      date: new Date('2024-12-22T09:00:00'),
      duration: 200,
      location: 'Session en ligne via Teams',
      capacity: 40,
      registrations: 28,
      price: 18000,
      instructor: {
        name: 'Fatima Diallo',
        rating: 4.6
      },
      type: 'ONLINE',
      category: 'Marketing',
      level: 'INTERMEDIAIRE'
    }
  ];

  const categories = Array.from(new Set(mockSessions.map(s => s.category)));
  const levels = ['DEBUTANT', 'INTERMEDIAIRE', 'AVANCE'];
  const types = ['ONLINE', 'PRESENTIAL'];

  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || session.category === selectedCategory;
    const matchesType = !selectedType || session.type === selectedType;
    const matchesLevel = !selectedLevel || session.level === selectedLevel;
    
    return matchesSearch && matchesCategory && matchesType && matchesLevel;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getLevelLabel = (level: string) => {
    const labels = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[level as keyof typeof labels] || level;
  };

  const getLevelColor = (level: string) => {
    const colors = {
      'DEBUTANT': 'bg-green-100 text-green-800',
      'INTERMEDIAIRE': 'bg-yellow-100 text-yellow-800',
      'AVANCE': 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type: string) => {
    return type === 'ONLINE' ? 'En ligne' : 'Présentiel';
  };

  const getTypeColor = (type: string) => {
    return type === 'ONLINE' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sessions de formation</h1>
            <p className="text-gray-600 mt-1">{filteredSessions.length} sessions disponibles</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative flex-1 lg:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher une session..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-gray-100"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tous les types</option>
                  <option value="ONLINE">En ligne</option>
                  <option value="PRESENTIAL">Présentiel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niveau
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tous les niveaux</option>
                  <option value="DEBUTANT">Débutant</option>
                  <option value="INTERMEDIAIRE">Intermédiaire</option>
                  <option value="AVANCE">Avancé</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setSelectedType('');
                    setSelectedLevel('');
                    setSearchTerm('');
                  }}
                  className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucune session trouvée avec ces critères</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredSessions.map((session, index) => {
            const availableSpots = session.capacity - session.registrations;
            const isAlmostFull = availableSpots <= 3;
            const isFullyBooked = availableSpots <= 0;

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSessionSelect(session)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{session.title}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(session.level)}`}>
                            {getLevelLabel(session.level)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(session.type)}`}>
                            {getTypeLabel(session.type)}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-4">{session.description}</p>
                    </div>
                    
                    <div className="text-right ml-6">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {formatPrice(session.price)} FCFA
                      </div>
                      {isFullyBooked ? (
                        <span className="text-sm text-red-600 font-medium">Complet</span>
                      ) : isAlmostFull ? (
                        <span className="text-sm text-orange-600 font-medium">
                          Plus que {availableSpots} places
                        </span>
                      ) : (
                        <span className="text-sm text-green-600 font-medium">
                          {availableSpots} places disponibles
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(session.date)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{session.duration} minutes</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{session.location}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{session.registrations}/{session.capacity} inscrits</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{session.instructor.name}</p>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">{session.instructor.rating}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                        isFullyBooked
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      disabled={isFullyBooked}
                    >
                      <span>{isFullyBooked ? 'Complet' : 'Réserver'}</span>
                      {!isFullyBooked && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};