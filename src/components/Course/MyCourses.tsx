import React, { useState } from 'react';
import { Play, Edit3, BarChart3, Trash2, Plus, Heart, Award, Megaphone } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMoney, formatPrice } from '../../lib/format';
import { mapCourse, mapEnrollment } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { CourseCard } from './CourseCard';
import { AnnouncementComposer } from './CourseAnnouncements';
import { BarChart, EmptyState, ErrorBox, Modal, PageHeader, Spinner, buttonPrimary } from '../UI';
import { ProgressBar, Tabs } from '../UI/kit';

const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Brouillon', 'bg-gray-100 text-gray-700'],
  PUBLISHED: ['Publié', 'bg-secondary-100 text-secondary-800'],
  PENDING_REVIEW: ['En validation', 'bg-sun-100 text-sun-800'],
  SCHEDULED: ['Programmé', 'bg-primary-100 text-primary-800'],
};

const CourseAnalyticsModal: React.FC<{ slug: string; title: string; onClose: () => void }> = ({ slug, title, onClose }) => {
  const { data, loading, error } = useApi(() => api.get(`/courses/${slug}/analytics/`), [slug]);
  return (
    <Modal title={`Statistiques — ${title}`} onClose={onClose}>
      {loading ? <Spinner className="h-40" /> : error ? <ErrorBox message={error} /> : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded p-3"><p className="text-gray-500">Inscrits</p><p className="text-xl font-bold">{data.total_enrollments}</p></div>
            <div className="bg-gray-50 rounded p-3"><p className="text-gray-500">Taux de complétion</p><p className="text-xl font-bold">{Math.round(data.completion_rate)} %</p></div>
            <div className="bg-gray-50 rounded p-3"><p className="text-gray-500">Progression moyenne</p><p className="text-xl font-bold">{Math.round(data.avg_progress)} %</p></div>
            <div className="bg-gray-50 rounded p-3"><p className="text-gray-500">Revenus nets</p><p className="text-xl font-bold">{formatMoney(data.net_revenue)}</p></div>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-2">Leçons terminées (entonnoir)</p>
            <BarChart data={data.lesson_funnel.map((l: any) => ({ label: l.title, value: l.completions }))} />
          </div>
        </div>
      )}
    </Modal>
  );
};

const InstructorCourses: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => (await api.get<any[]>('/courses/mine/')).map(mapCourse), []);
  const [stats, setStats] = useState<{ slug: string; title: string } | null>(null);
  const [announce, setAnnounce] = useState<{ slug: string; title: string } | null>(null);

  const archive = async (slug: string, title: string) => {
    if (!confirm(`Archiver « ${title} » ? Les étudiants inscrits gardent leur accès.`)) return;
    await api.delete(`/courses/${slug}/delete/`);
    reload();
  };

  return (
    <div>
      <PageHeader title="Mes cours" subtitle="Gérez vos formations" action={
        <button onClick={() => navigate('/create-course')} className={`${buttonPrimary} flex items-center space-x-2`}><Plus className="w-4 h-4" /><span>Nouveau cours</span></button>
      } />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <Spinner /> : !data?.length ? (
        <EmptyState title="Aucun cours" text="Créez votre premier cours en quelques minutes." />
      ) : (
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 divide-y divide-gray-100">
          {data.map((c) => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
              <img src={c.thumbnail} alt="" className="w-full sm:w-28 h-20 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{c.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS[c.status]?.[1] || 'bg-gray-100'}`}>{STATUS[c.status]?.[0] || c.status}</span>
                </div>
                <p className="text-sm text-gray-500">{formatPrice(c.price, c.currency)} · {c.lessonsCount} leçons · {c.studentsCount} étudiant(s) · {c.ratingCount ? `★ ${c.rating.toFixed(1)}` : "pas encore d'avis"}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button title="Envoyer une annonce" aria-label="Envoyer une annonce" onClick={() => setAnnounce({ slug: c.slug, title: c.title })} className="p-2 rounded-lg hover:bg-gray-100"><Megaphone className="w-5 h-5 text-gray-600" /></button>
                <button title="Statistiques" onClick={() => setStats({ slug: c.slug, title: c.title })} className="p-2 rounded-lg hover:bg-gray-100"><BarChart3 className="w-5 h-5 text-gray-600" /></button>
                <button title="Modifier" onClick={() => navigate(`/edit-course/${c.slug}`)} className="p-2 rounded-lg hover:bg-gray-100"><Edit3 className="w-5 h-5 text-gray-600" /></button>
                <button title="Archiver" onClick={() => archive(c.slug, c.title)} className="p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-5 h-5 text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {stats && <CourseAnalyticsModal {...stats} onClose={() => setStats(null)} />}
      {announce && <AnnouncementComposer slug={announce.slug} courseTitle={announce.title} onClose={() => setAnnounce(null)} />}
    </div>
  );
};

const StudentCourses: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'completed' | 'favorites'>('active');
  const { data, loading, error, reload } = useApi(async () => {
    const [enrollments, favorites] = await Promise.all([api.get('/courses/enrollments/'), api.get('/courses/favorites/')]);
    return { enrollments: (enrollments as any[]).map(mapEnrollment), favorites: (favorites as any[]).map(mapCourse) };
  }, []);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  const list = data.enrollments.filter((e) => (tab === 'completed' ? e.status === 'COMPLETED' : e.status === 'ACTIVE'));

  return (
    <div>
      <PageHeader title="Mes cours" subtitle={`${data.enrollments.length} cours suivis`} />
      <Tabs value={tab} onChange={setTab} className="mb-6" items={[
        { value: 'active', label: 'En cours', count: data.enrollments.filter((e) => e.status === 'ACTIVE').length },
        { value: 'completed', label: 'Terminés', count: data.enrollments.filter((e) => e.status === 'COMPLETED').length },
        { value: 'favorites', label: 'Favoris', count: data.favorites.length },
      ]} />
      {tab === 'favorites' ? (
        data.favorites.length === 0 ? <EmptyState title="Aucun favori" text="Ajoutez des cours à vos favoris depuis le catalogue." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.favorites.map((c) => <CourseCard key={c.id} course={c} onClick={() => navigate(`/courses/${c.slug}`)} />)}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState title="Rien ici pour l'instant" action={<button className={buttonPrimary} onClick={() => navigate('/catalog')}>Explorer le catalogue</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 overflow-hidden">
              <img src={e.course.thumbnail} alt="" className="w-full h-40 object-cover" />
              <div className="p-5 space-y-3">
                <h3 className="font-semibold text-gray-900 line-clamp-2">{e.course.title}</h3>
                <p className="text-sm text-gray-500">{e.course.instructor.name}</p>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1"><span>Progression</span><span>{Math.round(e.progress)} %</span></div>
                  <ProgressBar value={e.progress} label="Progression" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/learn/${e.course.slug}`)} className={`${buttonPrimary} flex-1 flex items-center justify-center space-x-2`}>
                    <Play className="w-4 h-4" /><span>{e.status === 'COMPLETED' ? 'Revoir' : 'Continuer'}</span>
                  </button>
                  {e.certificateCode && (
                    <button onClick={() => navigate(`/certificates/verify/${e.certificateCode}`)} title="Certificat" className="p-2 border rounded-lg"><Award className="w-5 h-5 text-sun-600" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab !== 'favorites' && data.favorites.length > 0 && (
        <p className="text-sm text-gray-500 mt-6 flex items-center space-x-1"><Heart className="w-4 h-4" /><span>{data.favorites.length} cours en favoris</span></p>
      )}
    </div>
  );
};

export const MyCourses: React.FC = () => {
  const { authState } = useAuth();
  return authState.user?.role === 'FORMATEUR' || authState.user?.role === 'ADMIN' ? <InstructorCourses /> : <StudentCourses />;
};
