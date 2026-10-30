import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, canTeach, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth';
import Catalog from './pages/Catalog';
import CourseDetail from './pages/CourseDetail';
import Learn from './pages/Learn';
import MyLearning from './pages/MyLearning';
import PaymentReturn from './pages/PaymentReturn';
import Teach from './pages/Teach';
import VerifyCertificate from './pages/VerifyCertificate';

function RequireAuth({ children, teacher = false }: { children: ReactNode; teacher?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) {
    return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (teacher && !canTeach(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <Link to="/" className="mt-4 inline-block text-brand-700 underline">Retour aux formations</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Catalog />} />
            <Route path="formations/:slug" element={<CourseDetail />} />
            <Route path="apprendre/:slug/:lessonId?" element={<Learn />} />
            <Route path="connexion" element={<Login />} />
            <Route path="inscription" element={<Register />} />
            <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="reinitialiser-mot-de-passe" element={<ResetPassword />} />
            <Route path="certificats/:code" element={<VerifyCertificate />} />
            <Route path="paiement/retour" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
            <Route path="mon-apprentissage" element={<RequireAuth><MyLearning /></RequireAuth>} />
            <Route path="formateur" element={<RequireAuth teacher><Teach /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
