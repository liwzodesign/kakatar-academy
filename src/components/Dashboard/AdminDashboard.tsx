import React from 'react';
import { Users, BookOpen, DollarSign, AlertTriangle, TrendingUp, Eye, UserCheck, Flag } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import { motion } from 'framer-motion';

export const AdminDashboard: React.FC = () => {
  const { allCourses } = useCourses();

  const stats = [
    { label: 'Utilisateurs actifs', value: '12,847', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100', change: '+534 ce mois' },
    { label: 'Cours publiés', value: '346', icon: BookOpen, color: 'text-green-600', bgColor: 'bg-green-100', change: '+23 ce mois' },
    { label: 'Chiffre d\'affaires', value: '45,250,000', icon: DollarSign, color: 'text-yellow-600', bgColor: 'bg-yellow-100', change: '+18% vs mois dernier' },
    { label: 'En attente de modération', value: '8', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', change: '↗ Urgent' }
  ];

  const pendingActions = [
    { type: 'course', title: 'Machine Learning Avancé', user: 'Dr. Aminata Sow', action: 'Validation cours', priority: 'high' },
    { type: 'instructor', title: 'Demande formateur', user: 'Pierre Dubois', action: 'Vérification compte', priority: 'medium' },
    { type: 'report', title: 'Signalement contenu', user: 'Cours Python Basics', action: 'Modération', priority: 'high' },
    { type: 'payout', title: 'Demande paiement', user: 'Sarah Chen', action: 'Validation virement', priority: 'low' }
  ];

  return (
    <div className="space-y-6">
      {/* En-tête admin */}
      <div className="bg-gradient-to-r from-purple-600 to-red-600 rounded-xl text-white p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold mb-2">Administration Kakatar 🛡️</h1>
          <p className="text-purple-100 text-lg">Tableau de bord de gestion de la plateforme</p>
        </motion.div>
      </div>

      {/* Actions rapides admin */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: UserCheck, label: 'Valider formateurs', color: 'bg-green-600 hover:bg-green-700' },
          { icon: Flag, label: 'Modération', color: 'bg-red-600 hover:bg-red-700' },
          { icon: BookOpen, label: 'Gérer cours', color: 'bg-blue-600 hover:bg-blue-700' },
          { icon: TrendingUp, label: 'Analytiques', color: 'bg-purple-600 hover:bg-purple-700' }
        ].map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`${action.color} text-white rounded-xl p-4 text-center transition-all duration-200 shadow-lg`}
            >
              <Icon className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">{action.label}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                {stat.label.includes('modération') && (
                  <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
                    Urgent
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  {stat.label.includes('affaires') 
                    ? `${new Intl.NumberFormat('fr-FR').format(parseInt(stat.value))} FCFA`
                    : stat.value
                  }
                </p>
                <p className={`text-sm font-medium ${
                  stat.change.includes('Urgent') ? 'text-red-600' : 'text-green-600'
                }`}>
                  {stat.change}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions en attente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Actions en attente</h2>
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
              {pendingActions.length} éléments
            </span>
          </div>

          <div className="space-y-4">
            {pendingActions.map((action, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    action.priority === 'high' ? 'bg-red-500' :
                    action.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600">{action.user}</p>
                    <p className="text-xs text-blue-600 font-medium">{action.action}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 transition-colors">
                    Approuver
                  </button>
                  <button className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors">
                    Rejeter
                  </button>
                  <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Cours les plus populaires */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Cours les plus populaires</h2>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {allCourses.slice(0, 4).map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{course.title}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-600">{course.instructor.name}</span>
                    <span className="text-xs text-green-600 font-medium">
                      {course.studentsCount} étudiants
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-yellow-600 font-medium">
                      ★ {course.rating}
                    </span>
                    <span className="text-xs text-blue-600 font-bold">
                      {new Intl.NumberFormat('fr-FR').format(course.price)} FCFA
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};