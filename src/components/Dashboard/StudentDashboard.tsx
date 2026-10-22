import React from 'react';
import { BookOpen, Clock, Trophy, TrendingUp, Calendar, Play, Star } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import { CourseCard } from '../Course/CourseCard';
import { motion } from 'framer-motion';

export const StudentDashboard: React.FC = () => {
  const { allCourses } = useCourses();

  const stats = [
    { label: 'Cours suivis', value: '12', icon: BookOpen, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { label: 'Heures d\'étude', value: '145h', icon: Clock, color: 'text-green-600', bgColor: 'bg-green-100' },
    { label: 'Certificats', value: '8', icon: Trophy, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    { label: 'Progression', value: '76%', icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-100' }
  ];

  const recentCourses = allCourses.slice(0, 3);
  const recommendedCourses = allCourses.slice(1, 4);

  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold mb-2">Bon retour, Marie ! 👋</h1>
          <p className="text-blue-100 text-lg">Continuez votre parcours d'apprentissage</p>
        </motion.div>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Cours en cours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Continuer l'apprentissage</h2>
          <button className="text-blue-600 hover:text-blue-700 font-medium">Voir tout</button>
        </div>

        <div className="space-y-4">
          {recentCourses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{course.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{course.instructor.name}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.random() * 80 + 10}%` }}
                  ></div>
                </div>
              </div>
              <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Play className="w-4 h-4" />
                <span>Continuer</span>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prochaines sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Prochaines sessions</h2>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {[
              { title: 'Workshop React Avancé', date: '15 Déc, 14h00', instructor: 'Dr. Jean Martin' },
              { title: 'Session Data Science', date: '18 Déc, 10h00', instructor: 'Sarah Chen' },
              { title: 'Atelier UX Design', date: '20 Déc, 16h00', instructor: 'Ahmed Okafor' }
            ].map((session, index) => (
              <motion.div
                key={session.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{session.title}</h3>
                  <p className="text-sm text-gray-600">{session.instructor}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">{session.date}</p>
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Réserver
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Cours recommandés */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recommandé pour vous</h2>
            <Star className="w-5 h-5 text-yellow-400" />
          </div>

          <div className="space-y-4">
            {recommendedCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
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
                    <span className="text-xs text-yellow-600 font-medium">
                      ★ {course.rating}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 font-bold mt-1">
                    {new Intl.NumberFormat('fr-FR').format(course.price)} FCFA
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};