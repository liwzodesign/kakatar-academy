import React from 'react';
import { BookOpen, Users, DollarSign, TrendingUp, Plus, Edit, Eye, BarChart } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import { motion } from 'framer-motion';

export const InstructorDashboard: React.FC = () => {
  const { allCourses } = useCourses();
  const myCourses = allCourses.slice(0, 2); // Simulation des cours du formateur

  const stats = [
    { label: 'Mes cours', value: '15', icon: BookOpen, color: 'text-blue-600', bgColor: 'bg-blue-100', change: '+2 ce mois' },
    { label: 'Étudiants totaux', value: '2,847', icon: Users, color: 'text-green-600', bgColor: 'bg-green-100', change: '+186 ce mois' },
    { label: 'Revenus mensuels', value: '1,250,000', icon: DollarSign, color: 'text-yellow-600', bgColor: 'bg-yellow-100', change: '+12% vs mois dernier' },
    { label: 'Taux de satisfaction', value: '4.8/5', icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-100', change: '↗ +0.2 ce mois' }
  ];

  return (
    <div className="space-y-6">
      {/* En-tête formateur */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl text-white p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold mb-2">Studio Formateur 🎓</h1>
          <p className="text-green-100 text-lg">Gérez vos cours et suivez vos performances</p>
        </motion.div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-6 text-left transition-all duration-200 shadow-lg"
        >
          <Plus className="w-8 h-8 mb-3" />
          <h3 className="text-xl font-bold mb-2">Créer un cours</h3>
          <p className="text-blue-100">Partagez votre expertise avec de nouveaux étudiants</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl p-6 text-left transition-all duration-200 shadow-lg"
        >
          <BarChart className="w-8 h-8 mb-3" />
          <h3 className="text-xl font-bold mb-2">Analytiques</h3>
          <p className="text-purple-100">Analysez les performances de vos cours</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl p-6 text-left transition-all duration-200 shadow-lg"
        >
          <Users className="w-8 h-8 mb-3" />
          <h3 className="text-xl font-bold mb-2">Mes étudiants</h3>
          <p className="text-orange-100">Interagissez avec votre communauté</p>
        </motion.button>
      </div>

      {/* Statistiques */}
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
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  {stat.label.includes('Revenus') 
                    ? `${new Intl.NumberFormat('fr-FR').format(parseInt(stat.value))} FCFA`
                    : stat.value
                  }
                </p>
                <p className="text-sm text-green-600 font-medium">{stat.change}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes cours */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Mes cours récents</h2>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Gérer tous</button>
          </div>

          <div className="space-y-4">
            {myCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl"
              >
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{course.title}</h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-600">
                      {course.studentsCount} étudiants
                    </span>
                    <span className="text-sm text-green-600 font-medium">
                      ★ {course.rating}/5
                    </span>
                  </div>
                  <p className="text-sm font-bold text-blue-600 mt-1">
                    {new Intl.NumberFormat('fr-FR').format(course.price)} FCFA
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Activité récente</h2>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {[
              { type: 'enrollment', message: '12 nouveaux étudiants inscrits à React & Next.js', time: 'Il y a 2h', color: 'bg-green-100 text-green-800' },
              { type: 'review', message: 'Nouvelle évaluation 5★ sur Data Science avec Python', time: 'Il y a 4h', color: 'bg-yellow-100 text-yellow-800' },
              { type: 'question', message: '3 nouvelles questions dans le forum JavaScript ES6+', time: 'Il y a 6h', color: 'bg-blue-100 text-blue-800' },
              { type: 'completion', message: '8 étudiants ont terminé le module React Hooks', time: 'Hier', color: 'bg-purple-100 text-purple-800' }
            ].map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.color.split(' ')[0]}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};