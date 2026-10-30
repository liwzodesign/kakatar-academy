import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, LogOut, Menu, Presentation, X } from 'lucide-react';
import { canTeach, useAuth } from '../auth/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = (
    <>
      <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>
        <BookOpen className="w-4 h-4" /> Formations
      </NavLink>
      {user && (
        <NavLink to="/mon-apprentissage" className={linkClass} onClick={() => setOpen(false)}>
          <GraduationCap className="w-4 h-4" /> Mon apprentissage
        </NavLink>
      )}
      {canTeach(user) && (
        <NavLink to="/formateur" className={linkClass} onClick={() => setOpen(false)}>
          <Presentation className="w-4 h-4" /> Espace formateur
        </NavLink>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">K</span>
            <span className="text-lg font-bold text-gray-900">Kakatar <span className="text-brand-600">Academy</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">{nav}</nav>
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <span className="text-sm text-gray-600">{user.first_name}</span>
                <button
                  onClick={async () => { await logout(); navigate('/'); }}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/connexion" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Connexion</Link>
                <Link to="/inscription" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Créer un compte</Link>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="space-y-1 border-t border-gray-100 px-4 py-3 md:hidden">
            {nav}
            {user ? (
              <button
                onClick={async () => { setOpen(false); await logout(); navigate('/'); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/connexion" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium">Connexion</Link>
                <Link to="/inscription" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-brand-600 py-2 text-center text-sm font-semibold text-white">Créer un compte</Link>
              </div>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Kakatar Academy · Une branche de Kakatar Graphic, Ngaparou
      </footer>
    </div>
  );
}
