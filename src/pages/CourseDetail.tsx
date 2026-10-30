import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, CheckCircle2, ChevronDown, Clock, Lock, PlayCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { formatDuration, formatPrice, LEVELS } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { CourseDetail as Course, Payment } from '../types';

interface Method { code: 'WAVE' | 'PAYDUNYA'; label: string }

function BuyBox({ course, onEnrolled }: { course: Course; onEnrolled: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const methods = useApi<Method[]>(Number(course.price) > 0 ? '/payments/methods/' : null);
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<{ final_price: string } | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const isFree = Number(course.price) === 0;
  const firstLesson = course.modules.flatMap((m) => m.lessons)[0];
  const learnPath = `/apprendre/${course.slug}`;

  if (course.is_enrolled) {
    const progress = Number(course.enrollment_progress?.progress || 0);
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-green-700">Vous êtes inscrit à cette formation.</p>
        <ProgressBar value={progress} />
        <p className="text-sm text-gray-600">{Math.round(progress)} % terminé</p>
        <Button className="w-full" onClick={() => navigate(learnPath)}>
          {progress > 0 ? 'Continuer' : 'Commencer'} la formation
        </Button>
      </div>
    );
  }

  const requireLogin = () => {
    if (!user) {
      navigate(`/connexion?suite=${encodeURIComponent(`/formations/${course.slug}`)}`);
      return true;
    }
    return false;
  };

  const enrollFree = async () => {
    if (requireLogin()) return;
    setBusy('free'); setError('');
    try { await api(`/courses/${course.slug}/enroll/`, { method: 'POST' }); onEnrolled(); navigate(learnPath); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const pay = async (gateway: Method['code']) => {
    if (requireLogin()) return;
    setBusy(gateway); setError('');
    try {
      const payment = await api<Payment>('/payments/checkout/', {
        body: { course_slug: course.slug, gateway, coupon_code: coupon.trim() },
      });
      if (payment.status === 'COMPLETED') {   // coupon à 100 %
        onEnrolled(); navigate(learnPath); return;
      }
      // Redirection plein écran vers Wave / PayDunya (pas d'iframe : Wave l'interdit)
      window.location.assign(payment.checkout_url);
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
    }
  };

  const applyCoupon = async () => {
    if (requireLogin() || !coupon.trim()) return;
    setError('');
    try {
      setQuote(await api('/payments/quote/', { body: { course_slug: course.slug, coupon_code: coupon.trim() } }));
    } catch (e) { setQuote(null); setError((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div>
        {quote ? (
          <p className="text-3xl font-bold text-gray-900">
            {formatPrice(quote.final_price, course.currency)}{' '}
            <span className="text-base font-normal text-gray-400 line-through">{formatPrice(course.price, course.currency)}</span>
          </p>
        ) : (
          <p className="text-3xl font-bold text-gray-900">{formatPrice(course.price, course.currency)}</p>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {isFree ? (
        <Button className="w-full" loading={busy === 'free'} onClick={enrollFree}>S'inscrire gratuitement</Button>
      ) : (
        <>
          {methods.loading && <Spinner label="Moyens de paiement…" />}
          {methods.data?.length === 0 && (
            <ErrorBox error="Le paiement en ligne n'est pas encore activé. Contactez-nous pour vous inscrire." />
          )}
          {methods.data?.map((m) => (
            <Button key={m.code} className="w-full" variant={m.code === 'WAVE' ? 'primary' : 'secondary'}
              loading={busy === m.code} disabled={!!busy} onClick={() => pay(m.code)}>
              <Smartphone className="h-4 w-4" /> Payer avec {m.label}
            </Button>
          ))}
          <div className="flex gap-2">
            <input value={coupon} onChange={(e) => { setCoupon(e.target.value); setQuote(null); }}
              placeholder="Code promo" aria-label="Code promo"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase" />
            <Button variant="secondary" onClick={applyCoupon} disabled={!coupon.trim()}>Appliquer</Button>
          </div>
        </>
      )}
      {firstLesson && !firstLesson.is_locked && (
        <Link to={`${learnPath}/${firstLesson.id}`} className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Voir la leçon d'aperçu gratuite
        </Link>
      )}
      <ul className="space-y-2 border-t border-gray-100 pt-4 text-sm text-gray-600">
        <li className="flex gap-2"><PlayCircle className="h-4 w-4 text-gray-400" />{course.lessons_count} leçons</li>
        {course.duration > 0 && <li className="flex gap-2"><Clock className="h-4 w-4 text-gray-400" />{formatDuration(course.duration)} de contenu</li>}
        {course.certificate_available && <li className="flex gap-2"><Award className="h-4 w-4 text-gray-400" />Certificat de réussite</li>}
      </ul>
    </div>
  );
}

export default function CourseDetail() {
  const { slug } = useParams();
  const { data: course, error, loading, reload } = useApi<Course>(`/courses/${slug}/`);
  const [openModule, setOpenModule] = useState<string | null>(null);

  if (loading && !course) return <Spinner />;
  if (error) return <div className="mx-auto max-w-3xl p-4"><ErrorBox error={error} onRetry={reload} /></div>;
  if (!course) return null;

  return (
    <div>
      <section className="bg-gray-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link to={`/?categorie=${course.category.slug}`} className="text-sm font-medium text-brand-300 hover:underline">{course.category.name}</Link>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold">{course.title}</h1>
          {course.subtitle && <p className="mt-3 max-w-3xl text-gray-300">{course.subtitle}</p>}
          <p className="mt-4 text-sm text-gray-400">
            {LEVELS[course.level]} · Formateur : <span className="text-white">{course.instructor.name}</span>
            {course.status !== 'PUBLISHED' && <span className="ml-2 rounded bg-yellow-400 px-2 py-0.5 text-xs font-bold text-gray-900">Brouillon</span>}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-3">
        <div className="order-2 space-y-8 lg:order-1 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">À propos</h2>
            <p className="whitespace-pre-line text-gray-700">{course.description}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">Programme</h2>
            <div className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {course.modules.map((m, i) => {
                const isOpen = openModule === m.id || (openModule === null && i === 0);
                return (
                  <div key={m.id}>
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      onClick={() => setOpenModule(isOpen ? '' : m.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="font-medium text-gray-900">Module {m.order} · {m.title}</span>
                      <span className="flex items-center gap-2 text-xs text-gray-500">
                        {m.lessons_count} leçons
                        <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {isOpen && (
                      <ul className="bg-gray-50 px-4 pb-3">
                        {m.lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-3 py-2 text-sm text-gray-700">
                            {l.is_completed ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                              : l.is_locked ? <Lock className="h-4 w-4 text-gray-400" />
                              : <PlayCircle className="h-4 w-4 text-brand-600" />}
                            <span className="flex-1">{l.title}</span>
                            {l.is_free && !course.is_enrolled && <span className="text-xs font-medium text-brand-700">Aperçu</span>}
                            {l.estimated_duration > 0 && <span className="text-xs text-gray-400">{l.estimated_duration} min</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {course.instructor.bio && (
            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900">Votre formateur</h2>
              <div className="flex gap-4">
                <img src={course.instructor.avatar} alt="" className="h-14 w-14 rounded-full" />
                <div>
                  <p className="font-semibold text-gray-900">{course.instructor.name}</p>
                  <p className="text-sm text-gray-600">{course.instructor.bio}</p>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="order-1 lg:order-2">
          <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <BuyBox course={course} onEnrolled={reload} />
          </div>
        </aside>
      </div>
    </div>
  );
}
