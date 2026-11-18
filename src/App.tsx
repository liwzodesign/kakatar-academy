import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { AuthModal } from './components/Auth/AuthModal';
import { Spinner } from './components/UI';
import { Landing } from './components/Landing/Landing';
import { Footer } from './components/Layout/Footer';
import { InstallPrompt } from './components/Layout/InstallPrompt';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { matchPath, navigate, useLocation } from './lib/router';

// Pages chargées à la demande : le premier affichage ne télécharge que le nécessaire (réseaux mobiles).
const CourseCatalog = lazy(() => import('./components/Course/CourseCatalog').then((m) => ({ default: m.CourseCatalog })));
const CourseDetail = lazy(() => import('./components/Course/CourseDetail').then((m) => ({ default: m.CourseDetail })));
const CoursePlayer = lazy(() => import('./components/Course/CoursePlayer').then((m) => ({ default: m.CoursePlayer })));
const CreateCourse = lazy(() => import('./components/Course/CreateCourse').then((m) => ({ default: m.CreateCourse })));
const MyCourses = lazy(() => import('./components/Course/MyCourses').then((m) => ({ default: m.MyCourses })));
const Certificates = lazy(() => import('./components/Course/Certificates').then((m) => ({ default: m.Certificates })));
const CertificateLookup = lazy(() => import('./components/Course/Certificates').then((m) => ({ default: m.CertificateLookup })));
const CertificateVerify = lazy(() => import('./components/Course/Certificates').then((m) => ({ default: m.CertificateVerify })));
const SessionList = lazy(() => import('./components/Session/SessionList').then((m) => ({ default: m.SessionList })));
const SessionBooking = lazy(() => import('./components/Session/SessionBooking').then((m) => ({ default: m.SessionBooking })));
const StudentDashboard = lazy(() => import('./components/Dashboard/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const InstructorDashboard = lazy(() => import('./components/Dashboard/InstructorDashboard').then((m) => ({ default: m.InstructorDashboard })));
const AdminDashboard = lazy(() => import('./components/Dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const Marketplace = lazy(() => import('./components/Marketplace/Marketplace').then((m) => ({ default: m.Marketplace })));
const ProductDetail = lazy(() => import('./components/Marketplace/Marketplace').then((m) => ({ default: m.ProductDetail })));
const Purchases = lazy(() => import('./components/Marketplace/Marketplace').then((m) => ({ default: m.Purchases })));
const Settings = lazy(() => import('./components/Account/Settings').then((m) => ({ default: m.Settings })));
const ResetPassword = lazy(() => import('./components/Account/Settings').then((m) => ({ default: m.ResetPassword })));
const SubscriptionTab = lazy(() => import('./components/Account/Settings').then((m) => ({ default: m.SubscriptionTab })));
const Support = lazy(() => import('./components/Account/Support').then((m) => ({ default: m.Support })));
const Students = lazy(() => import('./components/Instructor/InstructorPages').then((m) => ({ default: m.Students })));
const InstructorAnalytics = lazy(() => import('./components/Instructor/InstructorPages').then((m) => ({ default: m.InstructorAnalytics })));
const AdminUsers = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminUsers })));
const AdminModeration = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminModeration })));
const AdminPayments = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminPayments })));
const AdminAnalytics = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminAnalytics })));
const PaymentReturn = lazy(() => import('./components/Payment/PaymentPages').then((m) => ({ default: m.PaymentReturn })));
const PaymentSandbox = lazy(() => import('./components/Payment/PaymentPages').then((m) => ({ default: m.PaymentSandbox })));
const Corrections = lazy(() => import('./components/Instructor/Corrections').then((m) => ({ default: m.Corrections })));
const AdminCoupons = lazy(() => import('./components/Admin/AdminCoupons').then((m) => ({ default: m.AdminCoupons })));
const InstructorCoupons = lazy(() => import('./components/Instructor/InstructorCoupons').then((m) => ({ default: m.InstructorCoupons })));
const Reviews = lazy(() => import('./components/Learning/Reviews').then((m) => ({ default: m.Reviews })));
const PublicProfile = lazy(() => import('./components/Learning/PublicProfile').then((m) => ({ default: m.PublicProfile })));
const Downloads = lazy(() => import('./components/Course/Downloads').then((m) => ({ default: m.Downloads })));
const PathList = lazy(() => import('./components/Path/Paths').then((m) => ({ default: m.PathList })));
const PathDetail = lazy(() => import('./components/Path/Paths').then((m) => ({ default: m.PathDetail })));
const MyPaths = lazy(() => import('./components/Path/Paths').then((m) => ({ default: m.MyPaths })));
const InstructorCohorts = lazy(() => import('./components/Cohort/Cohorts').then((m) => ({ default: m.InstructorCohorts })));

/** Pages accessibles sans être connecté. */
const PUBLIC_ROUTES = ['/', '/catalog', '/courses/:slug', '/sessions', '/sessions/:id', '/marketplace',
  '/marketplace/:slug', '/reset-password', '/certificates/verify/:code', '/verify', '/support', '/paths', '/paths/:slug', '/u/:handle'];

/** Titre de l'onglet selon la page. */
const TITLES: [string, string][] = [
  ['/catalog', 'Catalogue des cours'], ['/courses/', 'Cours'], ['/learn/', 'Apprentissage'], ['/sessions', 'Sessions en direct'],
  ['/marketplace', 'Ressources'], ['/my-courses', 'Mes cours'], ['/certificates', 'Certificats'], ['/verify', 'Vérifier un certificat'],
  ['/purchases', 'Mes achats'], ['/settings', 'Paramètres'], ['/create-course', 'Nouveau cours'], ['/edit-course/', 'Édition du cours'],
  ['/students', 'Mes étudiants'], ['/analytics', 'Statistiques'], ['/users', 'Utilisateurs'], ['/moderation', 'Vérifications'],
  ['/payments', 'Paiements'], ['/assignments', 'Corrections'], ['/coupons', 'Codes promo'], ['/support', 'Aide'], ['/payment/', 'Paiement'], ['/paths', 'Parcours'], ['/my-paths', 'Mes parcours'], ['/downloads', 'Téléchargements'], ['/reviews', 'Révisions'], ['/u/', 'Profil'],
  ['/my-coupons', 'Mes codes promo'], ['/my-cohorts', 'Promotions'],
];

const NotFound: React.FC = () => (
  <div className="flex items-center justify-center min-h-96 text-center">
    <div>
      <p className="text-6xl mb-4">🧭</p>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Page introuvable</h2>
      <button onClick={() => navigate('/')} className="text-primary-600 underline">Retour à l'accueil</button>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { authState } = useAuth();
  const { path, query } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModal, setAuthModal] = useState<null | 'login' | 'register'>(null);
  const [registerRole, setRegisterRole] = useState<'ETUDIANT' | 'FORMATEUR'>('ETUDIANT');

  const role = authState.user?.role;
  const isPublic = PUBLIC_ROUTES.some((r) => matchPath(r, path));

  // Page protégée sans session : on propose la connexion
  useEffect(() => {
    if (!authState.loading && !authState.isAuthenticated && !isPublic) setAuthModal('login');
  }, [authState.loading, authState.isAuthenticated, isPublic]);

  const requireAuth = () => setAuthModal('login');

  useEffect(() => {
    const title = TITLES.find(([prefix]) => path.startsWith(prefix))?.[1];
    document.title = title ? `${title} · Kakatar Academy` : 'Kakatar Academy — Apprendre, progresser, réussir';
  }, [path]);

  const openRegister = (asRole: 'ETUDIANT' | 'FORMATEUR' = 'ETUDIANT') => {
    setRegisterRole(asRole);
    setAuthModal('register');
  };

  const route = (pattern: string) => matchPath(pattern, path);

  const renderPage = (): React.ReactNode => {
    if (authState.loading) return <Spinner />;
    let p: Record<string, string> | null;

    if (path === '/') {
      if (!authState.isAuthenticated) return null; // landing affichée hors layout
      if (role === 'FORMATEUR') return <InstructorDashboard />;
      if (role === 'ADMIN') return <AdminDashboard />;
      return <StudentDashboard />;
    }
    if (route('/catalog')) return <CourseCatalog key={query.get('category') || ''} initialSearch={query.get('q') || ''} initialCategory={query.get('category') || ''} onCourseSelect={(c) => navigate(`/courses/${c.slug}`)} />;
    if ((p = route('/courses/:slug'))) return <CourseDetail key={p.slug} slug={p.slug} onRequireAuth={requireAuth} />;
    if (route('/sessions')) return <SessionList />;
    if ((p = route('/sessions/:id'))) return <SessionBooking sessionId={p.id} onRequireAuth={requireAuth} />;
    if (route('/marketplace')) return <Marketplace />;
    if ((p = route('/marketplace/:slug'))) return <ProductDetail slug={p.slug} onRequireAuth={requireAuth} />;
    if (route('/reset-password')) return <ResetPassword uid={query.get('uid') || ''} token={query.get('token') || ''} />;
    if ((p = route('/certificates/verify/:code'))) return <CertificateVerify code={p.code} />;
    if (route('/verify')) return <CertificateLookup />;
    if (route('/support')) return <Support />;
    if (route('/paths')) return <PathList />;
    if ((p = route('/u/:handle'))) return <PublicProfile key={p.handle} handle={p.handle} />;
    if ((p = route('/paths/:slug'))) return <PathDetail key={p.slug} slug={p.slug} onRequireAuth={requireAuth} />;

    if (!authState.isAuthenticated) return <Spinner />;

    if ((p = route('/learn/:slug'))) return <CoursePlayer key={p.slug} slug={p.slug} initialLessonId={query.get('lesson')} initialPanel={query.get('tab')} />;
    if (route('/my-courses')) return <MyCourses />;
    if (route('/certificates')) return <Certificates />;
    if (route('/purchases')) return <Purchases />;
    if (route('/downloads')) return <Downloads />;
    if (route('/reviews')) return <Reviews />;
    if (route('/settings')) return <Settings />;
    if (route('/subscription')) return <SubscriptionTab />;
    if (route('/payment/sandbox')) return <PaymentSandbox paymentId={query.get('payment') || ''} />;
    if (route('/payment/return')) return <PaymentReturn paymentId={query.get('payment') || ''} />;

    const instructor = role === 'FORMATEUR' || role === 'ADMIN';
    if (instructor && route('/create-course')) return <CreateCourse />;
    if (instructor && (p = route('/edit-course/:slug'))) return <CreateCourse key={p.slug} slug={p.slug} />;
    if (instructor && route('/students')) return <Students />;
    if (instructor && route('/assignments')) return <Corrections />;
    if (instructor && route('/my-paths')) return <MyPaths />;
    if (instructor && route('/my-cohorts')) return <InstructorCohorts />;
    if (instructor && route('/my-coupons')) return <InstructorCoupons />;
    if (role === 'FORMATEUR' && route('/analytics')) return <InstructorAnalytics />;

    if (role === 'ADMIN') {
      if (route('/analytics')) return <AdminAnalytics />;
      if (route('/users')) return <AdminUsers />;
      if (route('/moderation')) return <AdminModeration />;
      if (route('/payments')) return <AdminPayments />;
      if (route('/coupons')) return <AdminCoupons />;
    }
    return <NotFound />;
  };

  // Mode concentration : le lecteur de cours occupe tout l'écran, sans menu ni en-tête
  const learnMatch = authState.isAuthenticated ? matchPath('/learn/:slug', path) : null;
  if (learnMatch) {
    return (
      <MotionConfig reducedMotion="user">
        <Suspense fallback={<Spinner className="min-h-screen" />}>
          <CoursePlayer key={learnMatch.slug} slug={learnMatch.slug} initialLessonId={query.get('lesson')} initialPanel={query.get('tab')} />
        </Suspense>
      </MotionConfig>
    );
  }

  const showLanding = path === '/' && !authState.isAuthenticated && !authState.loading;
  const withSidebar = authState.isAuthenticated;

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-gray-50 flex">
      {withSidebar && (
        <>
          {sidebarOpen && <div className="fixed inset-0 bg-primary-950/40 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
          <Sidebar
            isOpen={sidebarOpen}
            currentPath={path}
            onNavigate={(to) => {
              navigate(to);
              setSidebarOpen(false);
            }}
          />
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onSearch={(term) => navigate(`/catalog?q=${encodeURIComponent(term)}`)}
          onLogin={() => setAuthModal('login')}
          onRegister={() => openRegister()}
        />
        <main className="flex-1 overflow-y-auto">
          {showLanding ? (
            <Landing onStart={() => openRegister()} onTeach={() => openRegister('FORMATEUR')} />
          ) : (
            <div className="container-page py-6 sm:py-8"><Suspense fallback={<Spinner />}>{renderPage()}</Suspense></div>
          )}
        </main>
        {!authState.isAuthenticated && !authState.loading && <Footer />}
      </div>

      <InstallPrompt />
      <AnimatePresence>
        {authModal && (
          <AuthModal
            key={authModal}
            isOpen
            initialMode={authModal}
            initialRole={registerRole}
            onClose={(success) => {
              setAuthModal(null);
              if (!success && !isPublic && !authState.isAuthenticated) navigate('/', { replace: true });
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
