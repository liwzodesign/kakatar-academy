import React, { useState } from 'react';
import {
  Play, Clock, Users, Star, BookOpen, FileText, Share2, Heart, CheckCircle, Lock, Globe, Award, HelpCircle, Edit3,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatDuration, formatPrice, LEVEL_COLORS, LEVEL_LABELS } from '../../lib/format';
import { mapCourseDetail } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { CourseDetail as CourseDetailType } from '../../types';
import { Avatar, ErrorBox, Spinner, SuccessBox } from '../UI';
import { CheckoutModal } from '../Payment/CheckoutModal';
import { CourseCohorts } from '../Cohort/Cohorts';

interface CourseDetailProps {
  slug: string;
  onRequireAuth: () => void;
}

const Stars: React.FC<{ value: number; size?: string; dark?: boolean }> = ({ value, size = 'w-4 h-4', dark }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`${size} ${i < Math.round(value) ? 'text-sun-400 fill-current' : dark ? 'text-gray-500' : 'text-white/70'}`} />
    ))}
  </div>
);

const lessonIcon = (type: string) => {
  if (type === 'VIDEO') return <Play className="w-5 h-5 text-primary-600" />;
  if (type === 'QUIZ') return <HelpCircle className="w-5 h-5 text-secondary-600" />;
  if (type === 'PROJECT') return <BookOpen className="w-5 h-5 text-secondary-600" />;
  return <FileText className="w-5 h-5 text-sun-600" />;
};

/** Champ de réponse du formateur sous un avis (visible uniquement par l'auteur du cours). */
const ReviewReplyBox: React.FC<{ reviewId: string; initial: string; onSaved: () => void }> = ({ reviewId, initial, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-primary-700 hover:underline">
        {initial ? 'Modifier ma réponse' : 'Répondre publiquement'}
      </button>
    );
  }
  const save = async () => {
    setBusy(true);
    await api.post(`/courses/reviews/${reviewId}/reply/`, { reply: text }).finally(() => setBusy(false));
    setOpen(false);
    onSaved();
  };
  return (
    <div className="mt-3 space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} aria-label="Votre réponse"
        placeholder="Remerciez, précisez, annoncez une amélioration…" className="w-full p-3 rounded-xl ring-1 ring-gray-200 outline-none focus:ring-4 focus:ring-primary-100" />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="px-4 py-2 rounded-xl bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">Publier la réponse</button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>
      </div>
    </div>
  );
};

export const CourseDetail: React.FC<CourseDetailProps> = ({ slug, onRequireAuth }) => {
  const { authState } = useAuth();
  const { data: course, loading, error, reload, setData } = useApi(
    async () => mapCourseDetail(await api.get(`/courses/${slug}/`)),
    [slug, authState.isAuthenticated]
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'reviews' | 'instructor'>('overview');
  const [showCheckout, setShowCheckout] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });

  if (loading && !course) return <Spinner />;
  if (error || !course) return <ErrorBox message={error || 'Cours introuvable'} onRetry={reload} />;

  const c: CourseDetailType = course;
  const totalLessons = c.modules.reduce((acc, m) => acc + m.lessons.length, 0);

  const enroll = async () => {
    if (!authState.isAuthenticated) return onRequireAuth();
    setActionError('');
    if (c.price > 0 && c.type !== 'SUBSCRIPTION') return setShowCheckout(true);
    try {
      await api.post(`/courses/${c.slug}/enroll/`);
      navigate(`/learn/${c.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        if (c.type === 'SUBSCRIPTION') return navigate('/subscription');
        return setShowCheckout(true);
      }
      setActionError((err as Error).message);
    }
  };

  const toggleFavorite = async () => {
    if (!authState.isAuthenticated) return onRequireAuth();
    const res = await api.post(`/courses/${c.slug}/favorite/`);
    setData({ ...c, isFavorite: res.is_favorite });
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: c.title, url }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(url);
      setNotice('Lien copié dans le presse-papiers');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await api.post(`/courses/${c.slug}/reviews/create/`, review);
      setNotice(res.pending_moderation ? 'Merci ! Votre avis sera publié après modération.' : 'Merci pour votre avis !');
      setReview({ rating: 5, comment: '' });
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const canReview = c.isEnrolled && !c.isOwner && !c.reviews.some((r) => r.userName === authState.user?.name);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-4">Description du cours</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{c.description}</p>
            </div>
            {c.objectives.length > 0 && (
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-4">Ce que vous apprendrez</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {c.objectives.map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-secondary-600 flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {c.requirements.length > 0 && (
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-4">Prérequis</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  {c.requirements.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        );

      case 'curriculum':
        return (
          <div className="space-y-4">
            {c.modules.length === 0 && <p className="text-gray-500">Le programme sera bientôt disponible.</p>}
            {c.modules.map((module, moduleIndex) => (
              <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Module {moduleIndex + 1} : {module.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{module.lessons.length} leçons • {formatDuration(module.duration)}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {module.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      disabled={lesson.locked}
                      onClick={() => navigate(`/learn/${c.slug}?lesson=${lesson.id}`)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left disabled:cursor-default"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">{lesson.completed ? <CheckCircle className="w-5 h-5 text-secondary-600" /> : lessonIcon(lesson.type)}</div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{lesson.title}</h4>
                          {lesson.duration > 0 && <p className="text-xs text-gray-500">{lesson.duration} min</p>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(lesson.isFree || module.isFree) && !c.isEnrolled && (
                          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">Aperçu gratuit</span>
                        )}
                        {lesson.locked && <Lock className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">Avis des étudiants</h3>
              <div className="flex items-center space-x-2 mt-2">
                <Stars value={c.rating} size="w-5 h-5" />
                <span className="text-lg font-semibold text-gray-900">{c.rating.toFixed(1)}</span>
                <span className="text-gray-600">({c.ratingCount} avis)</span>
              </div>
            </div>

            {canReview && (
              <form onSubmit={submitReview} className="bg-primary-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-900">Donnez votre avis</p>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setReview({ ...review, rating: n })}>
                      <Star className={`w-6 h-6 ${n <= review.rating ? 'text-sun-400 fill-current' : 'text-white/70'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={review.comment}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })}
                  placeholder="Qu'avez-vous pensé de ce cours ?"
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <button className="bg-primary-700 text-white px-4 py-2 rounded-lg hover:bg-primary-800">Publier</button>
              </form>
            )}

            {c.reviews.length === 0 && <p className="text-gray-500">Aucun avis pour le moment.</p>}
            <div className="space-y-4">
              {c.reviews.map((r) => (
                <div key={r.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar name={r.userName} src={r.userAvatar} />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{r.userName}</h4>
                        <Stars value={r.rating} />
                        <span className="text-sm text-gray-500">{r.createdAt.toLocaleDateString('fr-FR')}</span>
                      </div>
                      {r.title && <p className="font-medium text-gray-900">{r.title}</p>}
                      <p className="text-gray-700">{r.comment}</p>
                      {r.instructorReply && (
                        <div className="mt-3 pl-4 border-l-2 border-primary-200">
                          <p className="text-xs font-bold text-primary-700">Réponse du formateur</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line mt-0.5">{r.instructorReply}</p>
                        </div>
                      )}
                      {c.isOwner && <ReviewReplyBox reviewId={r.id} initial={r.instructorReply || ''} onSaved={reload} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'instructor':
        return (
          <div className="flex items-start space-x-6">
            <Avatar name={c.instructor.name} src={c.instructor.avatar} size="w-24 h-24" />
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{c.instructor.name}</h3>
              <p className="text-gray-600 mb-4 whitespace-pre-line">{c.instructor.bio || 'Formateur sur Kakatar Academy.'}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center space-x-1"><Users className="w-4 h-4" /><span>{c.instructor.totalStudents ?? 0} étudiants</span></div>
                <div className="flex items-center space-x-1"><BookOpen className="w-4 h-4" /><span>{c.instructor.totalCourses ?? 0} cours</span></div>
                <div className="flex items-center space-x-1"><Star className="w-4 h-4 text-sun-400" /><span>{(c.instructor.rating ?? 0).toFixed(1)} / 5</span></div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div>
      <div className="relative overflow-hidden bg-primary-900 text-white rounded-3xl">
        <img aria-hidden src="/logo-mark.svg" alt="" className="absolute -right-16 -bottom-24 w-[28rem] opacity-[0.06] brightness-0 invert pointer-events-none" />
        <div aria-hidden className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-secondary-500/20 blur-3xl" />
        <div className="relative px-6 sm:px-10 py-10 sm:py-12">
          <button onClick={() => navigate('/catalog')} className="mb-6 text-white/70 hover:text-white transition-colors">← Retour au catalogue</button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${LEVEL_COLORS[c.level]}`}>{LEVEL_LABELS[c.level]}</span>
                {c.category && <span className="inline-flex px-3 py-1 rounded-full text-sm bg-white/10">{c.category}</span>}
                {c.status !== 'PUBLISHED' && <span className="inline-flex px-3 py-1 rounded-full text-sm bg-sun-500 text-white">Brouillon</span>}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{c.title}</h1>
              <p className="text-xl text-white/70 mb-6">{c.subtitle || c.shortDescription}</p>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center space-x-2">
                  {c.ratingCount > 0 ? (
                    <>
                      <Stars value={c.rating} dark />
                      <span className="font-semibold text-sun-400">{c.rating.toFixed(1)}</span>
                      <span className="text-white/70">({c.ratingCount} avis · {c.studentsCount.toLocaleString('fr-FR')} étudiants)</span>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-secondary-500/20 text-secondary-200 font-semibold">Nouveau cours</span>
                  )}
                </div>
                <div className="flex items-center space-x-1"><Clock className="w-4 h-4" /><span>{formatDuration(c.duration)}</span></div>
                <div className="flex items-center space-x-1"><BookOpen className="w-4 h-4" /><span>{totalLessons} leçons</span></div>
                <div className="flex items-center space-x-1"><Globe className="w-4 h-4" /><span>{c.language === 'en' ? 'Anglais' : 'Français'}</span></div>
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <Avatar name={c.instructor.name} src={c.instructor.avatar} />
                <div>
                  <p className="font-medium">{c.instructor.name}</p>
                  <p className="text-sm text-white/70">Formateur{c.instructor.verified ? ' vérifié' : ''}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white text-gray-900 rounded-xl shadow-xl overflow-hidden lg:sticky lg:top-8">
                <img src={c.thumbnail} alt={c.title} className="w-full h-48 object-cover" />
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {c.type === 'SUBSCRIPTION' ? 'Inclus dans l\'abonnement' : formatPrice(c.price, c.currency)}
                    </div>
                    {c.originalPrice && c.originalPrice > c.price && (
                      <p className="text-sm text-gray-500"><span className="line-through">{formatPrice(c.originalPrice, c.currency)}</span> · -{c.discountPercentage}%</p>
                    )}
                    <p className="text-sm text-gray-600">Accès à vie</p>
                  </div>

                  {actionError && <div className="mb-4"><ErrorBox message={actionError} /></div>}
                  {notice && <div className="mb-4"><SuccessBox message={notice} /></div>}

                  {c.isOwner ? (
                    <button onClick={() => navigate(`/edit-course/${c.slug}`)} className="w-full flex items-center justify-center space-x-2 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 mb-4">
                      <Edit3 className="w-4 h-4" /><span>Modifier le cours</span>
                    </button>
                  ) : c.isEnrolled ? (
                    <button onClick={() => navigate(`/learn/${c.slug}`)} className="w-full bg-secondary-600 text-white py-3 rounded-lg font-semibold hover:bg-secondary-700 transition-colors mb-4">
                      {c.enrollment?.progress ? `Continuer (${Math.round(c.enrollment.progress)} %)` : 'Commencer le cours'}
                    </button>
                  ) : (
                    <button onClick={enroll} className="w-full bg-primary-700 text-white py-3 rounded-lg font-semibold hover:bg-primary-800 transition-colors mb-4">
                      {c.price > 0 && c.type !== 'SUBSCRIPTION' ? 'Acheter ce cours' : "S'inscrire gratuitement"}
                    </button>
                  )}

                  <div className="flex items-center space-x-2 mb-6">
                    <button
                      onClick={toggleFavorite}
                      className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 border rounded-lg transition-colors ${c.isFavorite ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Heart className={`w-4 h-4 ${c.isFavorite ? 'fill-current' : ''}`} />
                      <span className="text-sm">{c.isFavorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}</span>
                    </button>
                    <button onClick={share} className="flex items-center justify-center p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4 text-secondary-600" /><span>Accès à vie, sur mobile et ordinateur</span></div>
                    {c.certificateAvailable && <div className="flex items-center space-x-2"><Award className="w-4 h-4 text-secondary-600" /><span>Certificat de fin de formation</span></div>}
                    <div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4 text-secondary-600" /><span>Tuteur IA sur chaque leçon</span></div>
                    <div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4 text-secondary-600" /><span>Quiz et exercices pratiques</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-10">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            <div className="border-b border-gray-200 mb-8 overflow-x-auto">
              <nav className="flex space-x-8">
                {[
                  { id: 'overview', label: 'Aperçu' },
                  { id: 'curriculum', label: 'Programme' },
                  { id: 'reviews', label: `Avis (${c.ratingCount})` },
                  { id: 'instructor', label: 'Formateur' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-8">{renderTabContent()}</div>
            <div className="mt-6"><CourseCohorts slug={c.slug} isOwner={c.isOwner} onRequireAuth={onRequireAuth} /></div>
          </div>

          <div className="mt-8 lg:mt-0">
            <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cours similaires</h3>
              <div className="space-y-4">
                {c.relatedCourses.length === 0 && <p className="text-sm text-gray-500">Aucun cours similaire pour le moment.</p>}
                {c.relatedCourses.map((r) => (
                  <button key={r.id} onClick={() => navigate(`/courses/${r.slug}`)} className="w-full flex items-center space-x-3 text-left hover:bg-gray-50 rounded-lg p-1">
                    <img src={r.thumbnail} alt="" className="w-16 h-12 rounded object-cover" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                      <p className="text-xs text-gray-500">{formatPrice(r.price, r.currency)} · ★ {r.rating.toFixed(1)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          title={c.title}
          amount={c.price}
          currency={c.currency}
          allowCoupon
          courseSlug={c.slug}
          onClose={() => setShowCheckout(false)}
          startCheckout={(gateway, coupon_code) => api.post('/payments/checkout/', { gateway, course_slug: c.slug, coupon_code })}
          onCompleted={() => navigate(`/learn/${c.slug}`)}
        />
      )}
    </div>
  );
};
