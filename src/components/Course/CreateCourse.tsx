import React, { useState } from 'react';
import { Plus, Upload, Video, FileText, HelpCircle, Save, Eye, Trash2, Contrast as DragDropContext, Cable as Draggable, Droplet as Droppable, GripVertical, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'PROJECT';
  duration: number;
  content?: string;
  videoUrl?: string;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  order: number;
}

interface CourseData {
  title: string;
  description: string;
  category: string;
  level: 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';
  price: number;
  thumbnail: string;
  modules: Module[];
}

export const CreateCourse: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    description: '',
    category: '',
    level: 'DEBUTANT',
    price: 0,
    thumbnail: '',
    modules: []
  });
  
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const steps = [
    { id: 1, title: 'Informations de base', description: 'Titre, description, catégorie' },
    { id: 2, title: 'Contenu du cours', description: 'Modules et leçons' },
    { id: 3, title: 'Tarification', description: 'Prix et options' },
    { id: 4, title: 'Publication', description: 'Révision et publication' }
  ];

  const categories = [
    'Développement Web',
    'Data Science',
    'Design',
    'Marketing',
    'Business',
    'Langues',
    'Photographie',
    'Musique'
  ];

  const addModule = () => {
    const newModule: Module = {
      id: Date.now().toString(),
      title: `Module ${courseData.modules.length + 1}`,
      description: '',
      lessons: [],
      order: courseData.modules.length
    };
    
    setCourseData(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
    
    setActiveModule(newModule.id);
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules.map(module =>
        module.id === moduleId ? { ...module, ...updates } : module
      )
    }));
  };

  const deleteModule = (moduleId: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules.filter(module => module.id !== moduleId)
    }));
    
    if (activeModule === moduleId) {
      setActiveModule(null);
    }
  };

  const addLesson = (moduleId: string) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const newLesson: Lesson = {
      id: Date.now().toString(),
      title: `Leçon ${module.lessons.length + 1}`,
      type: 'VIDEO',
      duration: 0,
      order: module.lessons.length
    };

    updateModule(moduleId, {
      lessons: [...module.lessons, newLesson]
    });
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedLessons = module.lessons.map(lesson =>
      lesson.id === lessonId ? { ...lesson, ...updates } : lesson
    );

    updateModule(moduleId, { lessons: updatedLessons });
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedLessons = module.lessons.filter(lesson => lesson.id !== lessonId);
    updateModule(moduleId, { lessons: updatedLessons });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre du cours *
              </label>
              <input
                type="text"
                value={courseData.title}
                onChange={(e) => setCourseData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Maîtriser React et Next.js"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={courseData.description}
                onChange={(e) => setCourseData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Décrivez ce que les étudiants apprendront dans ce cours..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie *
                </label>
                <select
                  value={courseData.category}
                  onChange={(e) => setCourseData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niveau *
                </label>
                <select
                  value={courseData.level}
                  onChange={(e) => setCourseData(prev => ({ ...prev, level: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="DEBUTANT">Débutant</option>
                  <option value="INTERMEDIAIRE">Intermédiaire</option>
                  <option value="AVANCE">Avancé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image de couverture
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Glissez-déposez une image ou cliquez pour parcourir</p>
                <p className="text-sm text-gray-500">PNG, JPG jusqu'à 5MB</p>
                <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Choisir un fichier
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Structure du cours</h3>
              <button
                onClick={addModule}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un module</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Modules List */}
              <div className="lg:col-span-1 space-y-4">
                {courseData.modules.map((module, index) => (
                  <div
                    key={module.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      activeModule === module.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveModule(module.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{module.title}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteModule(module.id);
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">{module.lessons.length} leçons</p>
                  </div>
                ))}

                {courseData.modules.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucun module créé</p>
                    <p className="text-sm">Cliquez sur "Ajouter un module" pour commencer</p>
                  </div>
                )}
              </div>

              {/* Module Editor */}
              <div className="lg:col-span-2">
                {activeModule ? (
                  <ModuleEditor
                    module={courseData.modules.find(m => m.id === activeModule)!}
                    onUpdateModule={(updates) => updateModule(activeModule, updates)}
                    onAddLesson={() => addLesson(activeModule)}
                    onUpdateLesson={(lessonId, updates) => updateLesson(activeModule, lessonId, updates)}
                    onDeleteLesson={(lessonId) => deleteLesson(activeModule, lessonId)}
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500">Sélectionnez un module pour le modifier</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix du cours (FCFA) *
              </label>
              <input
                type="number"
                value={courseData.price}
                onChange={(e) => setCourseData(prev => ({ ...prev, price: Number(e.target.value) }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                Laissez à 0 pour un cours gratuit
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Commission de la plateforme</h4>
              <p className="text-sm text-blue-800">
                Kakatar Academy prélève une commission de 15% sur chaque vente.
                Vous recevrez {courseData.price ? Math.round(courseData.price * 0.85) : 0} FCFA par vente.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Options de paiement</h4>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-gray-700">Paiement unique</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-gray-700">Paiement en plusieurs fois</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-gray-700">Codes de réduction</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Votre cours est prêt à être publié !
              </h3>
              <p className="text-green-800">
                Vérifiez toutes les informations ci-dessous avant de publier votre cours.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Résumé du cours</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Informations générales</h5>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li><strong>Titre:</strong> {courseData.title || 'Non défini'}</li>
                    <li><strong>Catégorie:</strong> {courseData.category || 'Non définie'}</li>
                    <li><strong>Niveau:</strong> {courseData.level}</li>
                    <li><strong>Prix:</strong> {courseData.price} FCFA</li>
                  </ul>
                </div>
                
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Contenu</h5>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li><strong>Modules:</strong> {courseData.modules.length}</li>
                    <li><strong>Leçons:</strong> {courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0)}</li>
                    <li><strong>Durée totale:</strong> {courseData.modules.reduce((acc, m) => acc + m.lessons.reduce((acc2, l) => acc2 + l.duration, 0), 0)} min</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>Aperçu</span>
              </button>
              
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Publier le cours
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.id}
              </div>
              <div className="ml-3">
                <p className={`font-medium ${
                  currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-8 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Précédent
        </button>

        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
            <Save className="w-4 h-4" />
            <span>Sauvegarder le brouillon</span>
          </button>

          <button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === 4 ? 'Publier' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Module Editor Component
const ModuleEditor: React.FC<{
  module: Module;
  onUpdateModule: (updates: Partial<Module>) => void;
  onAddLesson: () => void;
  onUpdateLesson: (lessonId: string, updates: Partial<Lesson>) => void;
  onDeleteLesson: (lessonId: string) => void;
}> = ({ module, onUpdateModule, onAddLesson, onUpdateLesson, onDeleteLesson }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre du module
          </label>
          <input
            type="text"
            value={module.title}
            onChange={(e) => onUpdateModule({ title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={module.description}
            onChange={(e) => onUpdateModule({ description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Leçons</h4>
          <button
            onClick={onAddLesson}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>Ajouter une leçon</span>
          </button>
        </div>

        <div className="space-y-3">
          {module.lessons.map((lesson, index) => (
            <div key={lesson.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Titre de la leçon
                  </label>
                  <input
                    type="text"
                    value={lesson.title}
                    onChange={(e) => onUpdateLesson(lesson.id, { title: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={lesson.type}
                    onChange={(e) => onUpdateLesson(lesson.id, { type: e.target.value as any })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="VIDEO">Vidéo</option>
                    <option value="TEXT">Texte</option>
                    <option value="QUIZ">Quiz</option>
                    <option value="PROJECT">Projet</option>
                  </select>
                </div>

                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Durée (min)
                    </label>
                    <input
                      type="number"
                      value={lesson.duration}
                      onChange={(e) => onUpdateLesson(lesson.id, { duration: Number(e.target.value) })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                  <button
                    onClick={() => onDeleteLesson(lesson.id)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {module.lessons.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              Aucune leçon dans ce module
            </div>
          )}
        </div>
      </div>
    </div>
  );
};