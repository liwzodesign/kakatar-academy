import React from 'react';
import { BookOpen, Clock, Trophy, Flame, Calendar, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { mapCourse, mapEnrollment } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { CourseCard } from '../Course/CourseCard';
import { EmptyState, ErrorBox, Spinner, StatCard, buttonPrimary } from '../UI';
import { ProgressBar } from '../UI/kit';
import { Achievements } from './Achievements';
import { DailyGoal } from './DailyGoal';
import { League, ReviewsBanner } from '../Learning/League';

export const StudentDashboard: React.FC = () => {
  const { authState } = useAuth();
  const { data, loading, error, reload } = useApi(async () => {
    const [dash, reco] = await Promise.all([api.get('/analytics/student/'), api.get('/ai/recommendations/', { limit: 3 }).catch(() => [])]);
    return {
      stats: dash.stats,
      inProgress: (dash.in_progress as any[]).map(mapEnrollment),
      upcoming: dash.upcoming_sessions,
      recommended: ((reco.length ? reco : dash.recommended) as any[]).map(mapCourse),
    };
  }, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Bon retour, {authState.user?.firstName || authState.user?.name} ! 👋</h1>
          <p className="text-primary-100 text-lg">
            {stats.current_streak > 1 ? `${stats.current_streak} jours d'apprentissage d'affilée, continuez !` : "Continuez votre parcours d'apprentissage"}
          </p>
        </motion.div>
      </div>

      <ReviewsBanner />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Cours suivis" value={stats.enrolled_courses} icon={BookOpen} />
        <StatCard label="Temps d'étude" value={formatDuration(stats.study_time_minutes)} icon={Clock} color="bg-secondary-100 text-secondary-600" />
        <StatCard label="Certificats" value={stats.certificates} icon={Trophy} color="bg-sun-100 text-sun-600" />
        <StatCard label="Série en cours" value={`${stats.current_streak} j`} hint={`Record : ${stats.longest_streak} j`} icon={Flame} color="bg-sun-100 text-sun-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-xl font-extrabold text-gray-900 mb-4">Continuer mes cours</h2>
          {data.inProgress.length === 0 ? (
            <EmptyState title="Aucun cours en cours" text="Explorez le catalogue pour commencer." action={<button className={buttonPrimary} onClick={() => navigate('/catalog')}>Voir le catalogue</button>} />
          ) : (
            <div className="space-y-4">
              {data.inProgress.map((e) => (
                <div key={e.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50">
                  <img src={e.course.thumbnail} alt="" className="w-20 h-14 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{e.course.title}</h3>
                    <p className="text-sm text-gray-500">{e.course.instructor.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <ProgressBar value={e.progress} className="flex-1" label="Progression" />
                      <span className="text-xs text-gray-600">{Math.round(e.progress)} %</span>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/learn/${e.course.slug}`)} className="p-3 bg-primary-700 text-white rounded-full hover:bg-primary-800"><Play className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-xl font-extrabold text-gray-900 mb-4">Prochaines sessions</h2>
          {data.upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune session réservée. <button className="text-primary-700 font-semibold hover:underline" onClick={() => navigate('/sessions')}>Voir les sessions</button></p>
          ) : (
            <div className="space-y-3">
              {data.upcoming.map((s: any) => (
                <button key={s.id} onClick={() => navigate(`/sessions/${s.id}`)} className="w-full text-left flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
                  <Calendar className="w-5 h-5 text-primary-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-500">{new Date(s.start_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DailyGoal />
        <League />
      </div>

      <Achievements />

      {data.recommended.length > 0 && (
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-4">Recommandés pour vous</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.recommended.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} onClick={() => navigate(`/courses/${course.slug}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
