import React from 'react';
import { Plus, BarChart3, Users, BookOpen, DollarSign, Star, TrendingUp, ShieldAlert, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { mapCourse } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { BarChart, ErrorBox, Spinner, StatCard } from '../UI';

export const InstructorDashboard: React.FC = () => {
  const { authState } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.get('/analytics/instructor/'), []);
  const { data: inbox } = useApi<any[]>(() => api.get('/community/instructor/inbox/'), []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
  const s = data.stats;
  const topCourses = (data.top_courses as any[]).map(mapCourse);

  const actions = [
    { label: 'Créer un cours', text: 'Partagez votre expertise', icon: Plus, path: '/create-course', color: 'from-primary-600 to-primary-700' },
    { label: 'Revenus & stats', text: 'Suivez vos performances', icon: BarChart3, path: '/analytics', color: 'from-secondary-600 to-secondary-700' },
    { label: 'Mes étudiants', text: 'Suivez leur progression', icon: Users, path: '/students', color: 'from-secondary-600 to-secondary-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Studio formateur</h1>
        <p className="text-gray-600">Bonjour {authState.user?.firstName}, voici l'activité de vos cours.</p>
      </div>

      {authState.user?.verificationStatus !== 'VERIFIED' && (
        <div className="flex items-start space-x-3 bg-sun-50 border border-sun-200 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-sun-600 mt-0.5" />
          <div className="text-sm text-sun-800">
            Votre compte n'est pas encore vérifié : vous pouvez préparer vos cours, mais pas les publier.{' '}
            <button className="underline font-medium" onClick={() => navigate('/settings?tab=verification')}>Envoyer mes justificatifs</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((a) => (
          <motion.button key={a.path} whileHover={{ scale: 1.02 }} onClick={() => navigate(a.path)} className={`bg-gradient-to-r ${a.color} text-white p-6 rounded-xl text-left`}>
            <a.icon className="w-8 h-8 mb-3" />
            <h3 className="text-xl font-bold mb-1">{a.label}</h3>
            <p className="text-white/80 text-sm">{a.text}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Cours publiés" value={s.published_courses} hint={`${s.draft_courses} brouillon(s)`} icon={BookOpen} />
        <StatCard label="Étudiants" value={s.total_students} hint={`+${s.new_students_this_month} ce mois-ci`} icon={Users} color="bg-secondary-100 text-secondary-600" />
        <StatCard label="Revenus nets" value={formatMoney(s.net_revenue)} hint={`${formatMoney(s.revenue_this_month)} ce mois-ci`} icon={DollarSign} color="bg-sun-100 text-sun-600" />
        <StatCard label="Note moyenne" value={s.rating_count ? s.rating_average.toFixed(1) : '—'} hint={`${s.rating_count} avis`} icon={Star} color="bg-secondary-100 text-secondary-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2"><TrendingUp className="w-5 h-5" /><span>Inscriptions (30 jours)</span></h2>
          <BarChart data={data.enrollments_30_days.map((d: any) => ({ label: d.date, value: d.value }))} />
        </div>
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Activité récente</h2>
          {data.recent_enrollments.length === 0 ? (
            <p className="text-gray-500 text-sm">Pas encore d'inscription.</p>
          ) : (
            <div className="space-y-3">
              {data.recent_enrollments.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{e.student}</p>
                    <p className="text-gray-500">{e.course}</p>
                  </div>
                  <span className="text-gray-400">{new Date(e.date).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5" /><span>Questions en attente de réponse ({inbox?.length || 0})</span>
        </h2>
        {!inbox?.length ? (
          <p className="text-gray-500 text-sm">Aucune question en attente. 👏</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {inbox.slice(0, 6).map((q) => (
              <button key={q.id} onClick={() => navigate(`/learn/${q.course_slug}?lesson=${q.lesson_id}&tab=discussion`)} className="w-full text-left py-3 hover:bg-gray-50">
                <p className="text-sm text-gray-900 line-clamp-2">« {q.body} »</p>
                <p className="text-xs text-gray-500 mt-1">{q.student} · {q.course_title} → {q.lesson_title} · {new Date(q.created_at).toLocaleDateString('fr-FR')}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Mes cours les plus suivis</h2>
          <button onClick={() => navigate('/my-courses')} className="text-primary-600 text-sm">Tout voir</button>
        </div>
        {topCourses.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun cours publié pour le moment.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {topCourses.map((c) => (
              <button key={c.id} onClick={() => navigate(`/edit-course/${c.slug}`)} className="w-full flex items-center space-x-4 py-3 text-left hover:bg-gray-50">
                <img src={c.thumbnail} alt="" className="w-16 h-12 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{c.title}</p>
                  <p className="text-sm text-gray-500">{c.studentsCount} étudiant(s) · {c.ratingCount ? `★ ${c.rating.toFixed(1)}` : "pas encore d'avis"} · {Math.round(c.completionRate)} % de complétion</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
