import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings, 
  SkipBack, 
  SkipForward,
  RotateCcw,
  Bookmark,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Lesson {
  id: string;
  title: string;
  duration: number;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'PROJECT';
  videoUrl?: string;
  content?: string;
  completed?: boolean;
  locked?: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CoursePlayerProps {
  modules: Module[];
  currentLessonId: string;
  onLessonChange: (lessonId: string) => void;
  onBack: () => void;
  progress: number;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  modules,
  currentLessonId,
  onLessonChange,
  onBack,
  progress
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [note, setNote] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentLesson = modules
    .flatMap(m => m.lessons)
    .find(l => l.id === currentLessonId);

  const allLessons = modules.flatMap(m => m.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const goToNextLesson = () => {
    if (currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
      if (!nextLesson.locked) {
        onLessonChange(nextLesson.id);
      }
    }
  };

  const goToPreviousLesson = () => {
    if (currentIndex > 0) {
      onLessonChange(allLessons[currentIndex - 1].id);
    }
  };

  const markAsCompleted = () => {
    // Logic to mark lesson as completed
    console.log('Marking lesson as completed:', currentLessonId);
  };

  const addBookmark = () => {
    console.log('Adding bookmark at:', currentTime);
  };

  const saveNote = () => {
    console.log('Saving note:', note, 'at time:', currentTime);
    setNote('');
    setShowNotes(false);
  };

  if (!currentLesson) {
    return <div>Leçon non trouvée</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 384 }}
            exit={{ width: 0 }}
            className="bg-white border-r border-gray-200 overflow-hidden"
          >
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={onBack}
                  className="text-gray-600 hover:text-gray-900 transition-colors mb-4"
                >
                  ← Retour au cours
                </button>
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  Formation React & Next.js
                </h2>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Progression</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {modules.map((module, moduleIndex) => (
                  <div key={module.id} className="border-b border-gray-100">
                    <div className="p-4 bg-gray-50">
                      <h3 className="font-medium text-gray-900">
                        {moduleIndex + 1}. {module.title}
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <button
                          key={lesson.id}
                          onClick={() => !lesson.locked && onLessonChange(lesson.id)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            lesson.id === currentLessonId ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                          } ${lesson.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {lesson.completed ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : lesson.locked ? (
                                <Lock className="w-5 h-5 text-gray-400" />
                              ) : lesson.type === 'VIDEO' ? (
                                <Play className="w-5 h-5 text-blue-600" />
                              ) : (
                                <div className="w-5 h-5 bg-gray-300 rounded" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {lessonIndex + 1}. {lesson.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {lesson.duration} min • {lesson.type}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Video Player */}
        <div className="relative bg-black flex-1">
          {currentLesson.type === 'VIDEO' ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={goToNextLesson}
                poster={`https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=800`}
              >
                <source src="/api/placeholder-video.mp4" type="video/mp4" />
              </video>

              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                <div className="flex items-center space-x-4 text-white">
                  <button
                    onClick={togglePlay}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={goToPreviousLesson}
                    disabled={currentIndex === 0}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors disabled:opacity-50"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={goToNextLesson}
                    disabled={currentIndex === allLessons.length - 1}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors disabled:opacity-50"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  <div className="flex items-center space-x-2 flex-1">
                    <span className="text-sm">{formatTime(currentTime)}</span>
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={(e) => handleSeek(Number(e.target.value))}
                        className="w-full h-1 bg-white bg-opacity-30 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <span className="text-sm">{formatTime(duration)}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-20 h-1 bg-white bg-opacity-30 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={addBookmark}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>

                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black bg-opacity-90 rounded-lg p-4 min-w-48">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-2">Vitesse</label>
                            <select
                              value={playbackRate}
                              onChange={(e) => setPlaybackRate(Number(e.target.value))}
                              className="w-full bg-white bg-opacity-20 rounded px-2 py-1 text-sm"
                            >
                              <option value={0.5}>0.5x</option>
                              <option value={0.75}>0.75x</option>
                              <option value={1}>1x</option>
                              <option value={1.25}>1.25x</option>
                              <option value={1.5}>1.5x</option>
                              <option value={2}>2x</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📄</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{currentLesson.title}</h3>
                <p className="text-gray-300">Contenu textuel ou quiz</p>
              </div>
            </div>
          )}

          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Lesson Complete Button */}
          <div className="absolute top-4 right-4">
            <button
              onClick={markAsCompleted}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Marquer comme terminé
            </button>
          </div>
        </div>

        {/* Notes Panel */}
        <AnimatePresence>
          {showNotes && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 200 }}
              exit={{ height: 0 }}
              className="bg-white border-t border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
                  <button
                    onClick={() => setShowNotes(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                <div className="flex space-x-4">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ajoutez une note à ce moment de la vidéo..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                  <button
                    onClick={saveNote}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};