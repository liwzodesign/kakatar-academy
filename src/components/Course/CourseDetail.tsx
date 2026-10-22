import React, { useState } from 'react';
import { 
  Play, 
  Clock, 
  Users, 
  Star, 
  BookOpen, 
  Download, 
  Share2, 
  Heart,
  CheckCircle,
  Lock,
  Globe,
  Award,
  MessageCircle
} from 'lucide-react';
import { Course, User } from '../../types';
import { motion } from 'framer-motion';

interface CourseDetailProps {
  course: Course;
  onEnroll: () => void;
  onBack: () => void;
  isEnrolled?: boolean;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({ 
  course, 
  onEnroll, 
  onBack, 
  isEnrolled = false 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'reviews' | 'instructor'>('overview');
  const [isWishlisted, setIsWishlisted] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  const getLevelColor = (level: string) => {
    const colors = {
      'DEBUTANT': 'bg-green-100 text-green-800',
      'INTERMEDIAIRE': 'bg-yellow-100 text-yellow-800',
      'AVANCE': 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getLevelLabel = (level: string) => {
    const labels = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[level as keyof typeof labels] || level;
  };

  const mockCurriculum = [
    {
      id: '1',
      title: 'Introduction et fondamentaux',
      lessons: [
        { id: '1-1', title: 'Présentation du cours', duration: 15, type: 'VIDEO', isPreview: true },
        { id: '1-2', title: 'Installation de l\'environnement', duration: 25, type: 'VIDEO', isPreview: false },
        { id: '1-3', title: 'Premier projet', duration: 30, type: 'PROJECT', isPreview: false }
      ]
    },
    {
      id: '2',
      title: 'Concepts avancés',
      lessons: [
        { id: '2-1', title: 'Architecture et patterns', duration: 45, type: 'VIDEO', isPreview: false },
        { id: '2-2', title: 'Quiz d\'évaluation', duration: 10, type: 'QUIZ', isPreview: false },
        { id: '2-3', title: 'Ressources complémentaires', duration: 0, type: 'TEXT', isPreview: false }
      ]
    }
  ];

  const mockReviews = [
    {
      id: '1',
      user: { name: 'Marie Dubois', avatar: null },
      rating: 5,
      comment: 'Excellent cours ! Les explications sont claires et les projets pratiques très enrichissants.',
      date: '2024-11-15'
    },
    {
      id: '2',
      user: { name: 'Pierre Martin', avatar: null },
      rating: 4,
      comment: 'Très bon contenu, j\'aurais aimé plus d\'exercices pratiques.',
      date: '2024-11-10'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Description du cours</h3>
              <p className="text-gray-700 leading-relaxed">{course.description}</p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Ce que vous apprendrez</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Maîtriser les concepts fondamentaux',
                  'Développer des projets concrets',
                  'Appliquer les meilleures pratiques',
                  'Obtenir une certification reconnue'
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Prérequis</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Connaissances de base en informatique</li>
                <li>Motivation et temps à consacrer à l'apprentissage</li>
                <li>Accès à un ordinateur avec connexion internet</li>
              </ul>
            </div>
          </div>
        );

      case 'curriculum':
        return (
          <div className="space-y-4">
            {mockCurriculum.map((module, moduleIndex) => (
              <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Module {moduleIndex + 1}: {module.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {module.lessons.length} leçons • {module.lessons.reduce((acc, lesson) => acc + lesson.duration, 0)} min
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {lesson.type === 'VIDEO' && <Play className="w-5 h-5 text-blue-600" />}
                          {lesson.type === 'QUIZ' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {lesson.type === 'PROJECT' && <BookOpen className="w-5 h-5 text-purple-600" />}
                          {lesson.type === 'TEXT' && <Download className="w-5 h-5 text-orange-600" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{lesson.title}</h4>
                          {lesson.duration > 0 && (
                            <p className="text-xs text-gray-500">{lesson.duration} min</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {lesson.isPreview && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Aperçu gratuit
                          </span>
                        )}
                        {!isEnrolled && !lesson.isPreview && (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Avis des étudiants</h3>
                <div className="flex items-center space-x-2 mt-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(course.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{course.rating}</span>
                  <span className="text-gray-600">({course.studentsCount} avis)</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {mockReviews.map((review) => (
                <div key={review.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {review.user.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{review.user.name}</h4>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">{review.date}</span>
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'instructor':
        return (
          <div className="space-y-6">
            <div className="flex items-start space-x-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {course.instructor.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{course.instructor.name}</h3>
                <p className="text-gray-600 mb-4">{course.instructor.bio}</p>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>2,847 étudiants</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BookOpen className="w-4 h-4" />
                    <span>15 cours</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span>4.8 évaluation</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">À propos du formateur</h4>
              <p className="text-gray-700 leading-relaxed">
                Expert reconnu dans son domaine avec plus de 10 ans d'expérience. 
                Passionné par la transmission de connaissances et l'accompagnement des apprenants 
                dans leur parcours professionnel.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={onBack}
            className="mb-6 text-gray-300 hover:text-white transition-colors"
          >
            ← Retour au catalogue
          </button>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(course.level)}`}>
                  {getLevelLabel(course.level)}
                </span>
              </div>
              
              <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
              <p className="text-xl text-gray-300 mb-6">{course.description}</p>
              
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(course.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-medium">{course.rating}</span>
                  <span className="text-gray-300">({course.studentsCount.toLocaleString()} étudiants)</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(course.duration)}</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <BookOpen className="w-4 h-4" />
                  <span>{course.lessonsCount} leçons</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Globe className="w-4 h-4" />
                  <span>Français</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 mt-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {course.instructor.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{course.instructor.name}</p>
                    <p className="text-sm text-gray-300">Formateur expert</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Course Preview Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-xl overflow-hidden sticky top-8">
                <div className="relative">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <button className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all">
                      <Play className="w-8 h-8 text-blue-600 ml-1" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {formatPrice(course.price)} FCFA
                    </div>
                    <p className="text-sm text-gray-600">Accès à vie</p>
                  </div>
                  
                  {isEnrolled ? (
                    <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors mb-4">
                      Continuer le cours
                    </button>
                  ) : (
                    <button
                      onClick={onEnroll}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-4"
                    >
                      S'inscrire maintenant
                    </button>
                  )}
                  
                  <div className="flex items-center space-x-2 mb-6">
                    <button
                      onClick={() => setIsWishlisted(!isWishlisted)}
                      className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 border rounded-lg transition-colors ${
                        isWishlisted
                          ? 'border-red-300 text-red-600 bg-red-50'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                      <span className="text-sm">Liste de souhaits</span>
                    </button>
                    
                    <button className="flex items-center justify-center p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Accès à vie</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Certificat de fin de formation</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Support communautaire</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Ressources téléchargeables</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-8">
              <nav className="flex space-x-8">
                {[
                  { id: 'overview', label: 'Aperçu' },
                  { id: 'curriculum', label: 'Programme' },
                  { id: 'reviews', label: 'Avis' },
                  { id: 'instructor', label: 'Formateur' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              {renderTabContent()}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="mt-8 lg:mt-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cours similaires</h3>
              <div className="space-y-4">
                {/* Placeholder for similar courses */}
                <div className="text-sm text-gray-500">
                  Chargement des recommandations...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};