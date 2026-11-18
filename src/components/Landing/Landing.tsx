import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, ArrowRight, Award, Sparkles, Video, MessagesSquare, Smartphone, ShieldCheck, BookOpen, Calendar,
  GraduationCap, CheckCircle2, MapPin,
} from 'lucide-react';
import { api, unwrap } from '../../lib/api';
import { mapCourse, mapSession } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { formatPrice } from '../../lib/format';
import { useApi } from '../../hooks/useApi';
import { CourseCard } from '../Course/CourseCard';

const CATEGORY_TINTS = [
  'bg-primary-50 text-primary-700',
  'bg-secondary-50 text-secondary-700',
  'bg-sun-50 text-sun-700',
  'bg-sky-100 text-sky-600',
  'bg-rose-100 text-rose-600',
];

const FEATURES = [
  { icon: Award, title: 'Certificats vérifiables', text: 'Chaque certificat possède un code unique que les recruteurs peuvent vérifier en ligne.', tint: 'bg-sun-100 text-sun-700' },
  { icon: Sparkles, title: 'Tuteur IA dans chaque leçon', text: 'Posez vos questions, obtenez un résumé, révisez avec des quiz générés automatiquement.', tint: 'bg-primary-100 text-primary-700' },
  { icon: Video, title: 'Sessions en direct', text: 'Ateliers en ligne ou en présentiel avec les formateurs, avec rappel avant chaque séance.', tint: 'bg-sky-100 text-sky-600' },
  { icon: MessagesSquare, title: 'Questions & réponses', text: 'Sous chaque leçon, échangez avec le formateur et les autres apprenants.', tint: 'bg-rose-100 text-rose-600' },
  { icon: Smartphone, title: 'Payez comme vous voulez', text: 'Wave, Orange Money, Free Money ou carte bancaire, sur une page de paiement sécurisée.', tint: 'bg-secondary-100 text-secondary-700' },
  { icon: ShieldCheck, title: 'Formateurs vérifiés', text: 'Identité et parcours de chaque formateur sont contrôlés avant la publication de ses cours.', tint: 'bg-gray-100 text-gray-700' },
];

const STEPS = [
  { n: '1', title: 'Choisissez un cours', text: 'Parcourez le catalogue, regardez les leçons d\'aperçu gratuites.' },
  { n: '2', title: 'Apprenez à votre rythme', text: 'Vidéos, lectures, quiz et tuteur IA, sur mobile comme sur ordinateur.' },
  { n: '3', title: 'Obtenez votre certificat', text: 'Terminez le parcours et partagez un certificat vérifiable.' },
];

const SectionTitle: React.FC<{ eyebrow: string; title: string; action?: React.ReactNode }> = ({ eyebrow, title, action }) => (
  <div className="flex items-end justify-between gap-4 mb-8">
    <div>
      <p className="text-sm font-semibold text-secondary-600 mb-2">{eyebrow}</p>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h2>
    </div>
    {action}
  </div>
);

export const Landing: React.FC<{ onStart: () => void; onTeach: () => void }> = ({ onStart, onTeach }) => {
  const [query, setQuery] = useState('');
  const { data } = useApi(async () => {
    const [featured, categories, sessions, catalog] = await Promise.all([
      api.get<any[]>('/courses/featured/').catch(() => []),
      api.get('/courses/categories/').catch(() => []),
      api.get('/sessions/', { page_size: 3 }).catch(() => ({ results: [] })),
      api.get('/courses/', { page_size: 1 }).catch(() => ({ count: 0 })),
    ]);
    return {
      featured: featured.map(mapCourse),
      categories: unwrap<any>(categories),
      sessions: unwrap<any>(sessions).map(mapSession).slice(0, 3),
      courseCount: catalog.count || 0,
    };
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/catalog?q=${encodeURIComponent(query.trim())}` : '/catalog');
  };

  const heroCourse = data?.featured[0];

  return (
    <div className="bg-white">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-secondary-100/60 blur-3xl" />
        <div aria-hidden className="absolute -bottom-48 -left-40 w-[32rem] h-[32rem] rounded-full bg-primary-100/70 blur-3xl" />
        <div className="relative container-page pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary-50 text-secondary-700 px-3 py-1 text-sm font-semibold ring-1 ring-secondary-200">
              <span className="w-2 h-2 rounded-full bg-secondary-500" /> Apprentissage en ligne et en présentiel
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary-900 leading-[1.05]">
              Apprenez avec les meilleurs.{' '}
              <span className="bg-gradient-to-r from-primary-600 to-secondary-500 bg-clip-text text-transparent">Progressez à votre rythme.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 max-w-xl">
              Des cours conçus par des formateurs vérifiés, un tuteur IA à chaque leçon, des sessions en direct et des
              certificats reconnus. Payez simplement avec Wave, Orange Money ou votre carte.
            </p>

            <form onSubmit={search} role="search" className="mt-8 flex items-center gap-2 p-2 bg-white rounded-2xl shadow-lift ring-1 ring-gray-100 max-w-xl">
              <Search className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Que voulez-vous apprendre ?"
                placeholder="Un cours, un sujet…"
                className="flex-1 min-w-0 py-2 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
              />
              <button className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors">Rechercher</button>
            </form>

            {data && data.categories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {data.categories.slice(0, 5).map((c: any) => (
                  <button key={c.id} onClick={() => navigate(`/catalog?category=${c.slug}`)} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-600">
              {['Leçons d\'aperçu gratuites', 'Accès à vie', 'Certificat inclus'].map((t) => (
                <span key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-secondary-500" />{t}</span>
              ))}
            </div>
          </motion.div>

          {/* Composition visuelle : blason + vraie carte de cours + certificat */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative hidden lg:block">
            <div className="relative mx-auto w-[30rem] h-[30rem] rounded-[2.5rem] bg-brand-gradient shadow-lift overflow-hidden">
              <img src="/logo-mark.svg" alt="" className="absolute -right-10 -bottom-10 w-80 opacity-[0.12] brightness-0 invert" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between text-white">
                <div>
                  <p className="text-white/70 text-sm font-medium">Catalogue</p>
                  <p className="text-4xl font-extrabold mt-1">{data ? data.courseCount : '—'} cours</p>
                  <p className="text-white/70 text-sm mt-1">{data ? data.categories.length : '—'} domaines d'expertise</p>
                </div>
                {heroCourse && (
                  <button onClick={() => navigate(`/courses/${heroCourse.slug}`)} className="bg-white text-left rounded-2xl p-3 flex gap-3 items-center shadow-card hover:scale-[1.02] transition-transform">
                    <img src={heroCourse.thumbnail} alt="" className="w-20 h-16 rounded-xl object-cover" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-secondary-600">{heroCourse.category}</span>
                      <span className="block text-sm font-bold text-gray-900 line-clamp-2">{heroCourse.title}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{heroCourse.instructor.name} · {formatPrice(heroCourse.price, heroCourse.currency)}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-10 top-[46%] bg-white rounded-2xl shadow-lift p-4 flex items-center gap-3 ring-1 ring-gray-100">
              <span className="w-11 h-11 rounded-xl bg-sun-100 flex items-center justify-center"><Award className="w-6 h-6 text-sun-600" /></span>
              <span><span className="block text-sm font-bold text-gray-900">Certificat obtenu</span><span className="block text-xs text-gray-500">Vérifiable en ligne</span></span>
            </motion.div>
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -right-6 top-10 bg-white rounded-2xl shadow-lift p-4 flex items-center gap-3 ring-1 ring-gray-100">
              <span className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center"><Sparkles className="w-6 h-6 text-primary-700" /></span>
              <span><span className="block text-sm font-bold text-gray-900">Tuteur IA</span><span className="block text-xs text-gray-500">Disponible à chaque leçon</span></span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Moyens de paiement ---------------- */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="container-page py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-gray-500">
          <span className="text-gray-400 font-medium">Paiement sécurisé avec</span>
          <span className="text-sky-600">Wave</span>
          <span className="text-sun-600">Orange Money</span>
          <span className="text-rose-600">Free Money</span>
          <span className="text-primary-700">Carte bancaire</span>
        </div>
      </section>

      {/* ---------------- Catégories ---------------- */}
      {data && data.categories.length > 0 && (
        <section className="container-page py-16 sm:py-20">
          <SectionTitle eyebrow="Explorer" title="Trouvez votre prochain domaine" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.categories.map((c: any, i: number) => (
              <button key={c.id} onClick={() => navigate(`/catalog?category=${c.slug}`)}
                className="group text-left p-5 rounded-2xl bg-white ring-1 ring-gray-100 shadow-card hover:shadow-lift hover:-translate-y-0.5 transition-all">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]}`}>
                  <BookOpen className="w-5 h-5" />
                </span>
                <span className="block mt-4 font-bold text-gray-900 group-hover:text-primary-700">{c.name}</span>
                <span className="block text-sm text-gray-500">{c.courses_count} cours</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Cours à la une ---------------- */}
      {data && data.featured.length > 0 && (
        <section className="bg-gray-50 py-16 sm:py-20">
          <div className="container-page">
            <SectionTitle eyebrow="À la une" title="Les cours plébiscités" action={
              <button onClick={() => navigate('/catalog')} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary-700 hover:gap-2 transition-all">
                Tout le catalogue <ArrowRight className="w-4 h-4" />
              </button>
            } />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.featured.slice(0, 6).map((c) => <CourseCard key={c.id} course={c} onClick={() => navigate(`/courses/${c.slug}`)} />)}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Fonctionnalités ---------------- */}
      <section className="container-page py-16 sm:py-24">
        <SectionTitle eyebrow="Pourquoi Kakatar Academy" title="Tout ce qu'il faut pour vraiment progresser" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl bg-white ring-1 ring-gray-100 shadow-card">
              <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.tint}`}><f.icon className="w-6 h-6" /></span>
              <h3 className="mt-5 text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Étapes ---------------- */}
      <section className="bg-primary-900 text-white py-16 sm:py-20 relative overflow-hidden">
        <img aria-hidden src="/logo-mark.svg" alt="" className="absolute -left-16 -bottom-24 w-96 opacity-[0.06] brightness-0 invert" />
        <div className="container-page relative">
          <p className="text-sm font-semibold text-secondary-300 mb-2">Comment ça marche</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-10">Trois étapes vers votre objectif</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <span className="w-10 h-10 rounded-full bg-secondary-500 text-primary-950 font-extrabold flex items-center justify-center">{s.n}</span>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-white/70">{s.text}</p>
              </div>
            ))}
          </div>
          <button onClick={onStart} className="mt-10 inline-flex items-center gap-2 bg-sun-500 hover:bg-sun-400 text-primary-950 font-bold px-6 py-3.5 rounded-xl transition-colors">
            Créer mon compte gratuit <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ---------------- Sessions ---------------- */}
      {data && data.sessions.length > 0 && (
        <section className="container-page py-16 sm:py-20">
          <SectionTitle eyebrow="En direct" title="Prochaines sessions" action={
            <button onClick={() => navigate('/sessions')} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary-700 hover:gap-2 transition-all">
              Toutes les sessions <ArrowRight className="w-4 h-4" />
            </button>
          } />
          <div className="grid gap-5 md:grid-cols-3">
            {data.sessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/sessions/${s.id}`)} className="text-left p-6 rounded-2xl ring-1 ring-gray-100 shadow-card hover:shadow-lift transition-shadow bg-white">
                <div className="flex items-center gap-3">
                  <span className="text-center rounded-xl bg-primary-50 text-primary-700 px-3 py-2 leading-none">
                    <span className="block text-xl font-extrabold">{s.date.getDate()}</span>
                    <span className="block text-[11px] font-semibold uppercase mt-1">{s.date.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </span>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-secondary-50 text-secondary-700">
                    {s.type === 'ONLINE' ? 'En ligne' : s.type === 'PRESENTIAL' ? 'Présentiel' : 'Hybride'}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-gray-900 line-clamp-2">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
                  {s.type === 'ONLINE' ? <Calendar className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  <span className="truncate">{s.type === 'ONLINE' ? s.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : s.location}</span>
                </p>
                <p className="mt-3 font-bold text-primary-700">{formatPrice(s.price, s.currency)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Devenir formateur ---------------- */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-8 sm:p-12 text-white">
          <img aria-hidden src="/logo-mark.svg" alt="" className="absolute right-6 -bottom-16 w-72 opacity-10 brightness-0 invert" />
          <div className="relative max-w-2xl">
            <GraduationCap className="w-10 h-10 text-sun-400" />
            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold">Vous avez une expertise ? Enseignez-la.</h2>
            <p className="mt-3 text-white/80 text-lg">
              Créez vos cours avec notre éditeur, animez des sessions en direct, vendez vos ressources, et suivez vos
              revenus en temps réel.
            </p>
            <button onClick={onTeach} className="mt-8 inline-flex items-center gap-2 bg-white text-primary-800 font-bold px-6 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
              Devenir formateur <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
