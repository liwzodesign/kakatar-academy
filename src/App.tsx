import React, { useState } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { AuthModal } from './components/Auth/AuthModal';
import { CourseCatalog } from './components/Course/CourseCatalog';
import { CourseDetail } from './components/Course/CourseDetail';
import { CoursePlayer } from './components/Course/CoursePlayer';
import { CreateCourse } from './components/Course/CreateCourse';
import { SessionList } from './components/Session/SessionList';
import { SessionBooking } from './components/Session/SessionBooking';
import { StudentDashboard } from './components/Dashboard/StudentDashboard';
import { InstructorDashboard } from './components/Dashboard/InstructorDashboard';
import { AdminDashboard } from './components/Dashboard/AdminDashboard';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useCourses } from './hooks/useCourses';
import { motion, AnimatePresence } from 'framer-motion';

const AppContent: React.FC = () => {
  const { authState } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(!authState.isAuthenticated);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const { allCourses } = useCourses();

  const handleSearch = (term: string) => {
    console.log('Recherche:', term);
    setCurrentView('catalog');
  };

  const handleCourseSelect = (course: any) => {
    setSelectedCourse(course);
    setCurrentView('course-detail');
  };

  const handleEnrollCourse = () => {
    setIsEnrolled(true);
    setCurrentView('course-player');
  };

  const handleSessionSelect = (session: any) => {
    setSelectedSession(session);
    setCurrentView('session-booking');
  };

  const handleSessionBook = (sessionId: string, participantInfo: any) => {
    console.log('Session booked:', sessionId, participantInfo);
    setCurrentView('sessions');
  };

  const renderMainContent = () => {
    if (!authState.isAuthenticated) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-2xl"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-8">
              <span className="text-3xl">🎓</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Bienvenue sur Kakatar Academy
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Votre plateforme d'apprentissage hybride nouvelle génération
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  📚
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Cours d'expert</h3>
                <p className="text-gray-600 text-sm">Apprenez avec les meilleurs formateurs</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  🏆
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Certifications</h3>
                <p className="text-gray-600 text-sm">Obtenez des certificats reconnus</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  👥
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Communauté</h3>
                <p className="text-gray-600 text-sm">Échangez avec d'autres apprenants</p>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
            >
              Commencer maintenant
            </button>
          </motion.div>
        </div>
      );
    }

    const userRole = authState.user?.role;
    
    switch (currentView) {
      case 'dashboard':
        if (userRole === 'ETUDIANT') return <StudentDashboard />;
        if (userRole === 'FORMATEUR') return <InstructorDashboard />;
        if (userRole === 'ADMIN') return <AdminDashboard />;
        return <StudentDashboard />;
        
      case 'catalog':
      case 'my-courses':
        return <CourseCatalog onCourseSelect={handleCourseSelect} />;
        
      case 'course-detail':
        return selectedCourse ? (
          <CourseDetail
            course={selectedCourse}
            onEnroll={handleEnrollCourse}
            onBack={() => setCurrentView('catalog')}
            isEnrolled={isEnrolled}
          />
        ) : (
          <CourseCatalog onCourseSelect={handleCourseSelect} />
        );
        
      case 'course-player':
        return selectedCourse ? (
          <CoursePlayer
            modules={[
              {
                id: '1',
                title: 'Introduction',
                lessons: [
                  { id: '1-1', title: 'Présentation du cours', duration: 15, type: 'VIDEO', completed: true },
                  { id: '1-2', title: 'Installation', duration: 25, type: 'VIDEO', completed: false },
                  { id: '1-3', title: 'Premier projet', duration: 30, type: 'PROJECT', completed: false, locked: true }
                ]
              }
            ]}
            currentLessonId="1-1"
            onLessonChange={(lessonId) => console.log('Lesson changed:', lessonId)}
            onBack={() => setCurrentView('course-detail')}
            progress={25}
          />
        ) : null;
        
      case 'create-course':
        return <CreateCourse />;
        
      case 'sessions':
        return <SessionList onSessionSelect={handleSessionSelect} />;
        
      case 'session-booking':
        return selectedSession ? (
          <SessionBooking
            session={selectedSession}
            onBook={handleSessionBook}
            onBack={() => setCurrentView('sessions')}
          />
        ) : (
          <SessionList onSessionSelect={handleSessionSelect} />
        );
        
      default:
        return (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Section en construction</h2>
              <p className="text-gray-600">Cette fonctionnalité sera disponible prochainement.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {authState.isAuthenticated && (
        <>
          {/* Overlay mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          {/* Sidebar */}
          <Sidebar
            isOpen={sidebarOpen}
            currentView={currentView}
            onViewChange={(view) => {
              setCurrentView(view);
              setSidebarOpen(false);
            }}
          />
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {authState.isAuthenticated && (
          <Header
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onSearch={handleSearch}
          />
        )}
        
        <main className="flex-1 overflow-y-auto">
          {authState.isAuthenticated ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {renderMainContent()}
            </div>
          ) : (
            renderMainContent()
          )}
        </main>
      </div>

      {/* Modal d'authentification */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
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