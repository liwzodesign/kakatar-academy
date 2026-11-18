import React from 'react';
import { Star, Clock, BookOpen, BadgeCheck } from 'lucide-react';
import { Course } from '../../types';
import { formatDuration, formatPrice, LEVEL_LABELS } from '../../lib/format';
import { Avatar } from '../UI';

interface CourseCardProps {
  course: Course;
  onClick?: () => void;
}

const LEVEL_STYLE: Record<string, string> = {
  DEBUTANT: 'bg-secondary-50 text-secondary-700 ring-secondary-200',
  INTERMEDIAIRE: 'bg-sun-50 text-sun-700 ring-sun-100',
  AVANCE: 'bg-rose-100 text-rose-600 ring-rose-100',
};

/** Carte de cours : entièrement cliquable et accessible au clavier. */
export const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => (
  <article className="group relative flex flex-col bg-white rounded-2xl ring-1 ring-gray-100 shadow-card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
    <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
      <img
        src={course.thumbnail}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 backdrop-blur ${LEVEL_STYLE[course.level] || 'bg-gray-100 text-gray-700'}`}>
        {LEVEL_LABELS[course.level] || course.level}
      </span>
      {course.discountPercentage > 0 && (
        <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold bg-sun-500 text-primary-950">-{course.discountPercentage}%</span>
      )}
    </div>

    <div className="flex-1 flex flex-col p-5">
      {course.category && <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">{course.category}</p>}
      <h3 className="mt-1.5 text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
        {/* Le lien couvre toute la carte (motif « stretched link ») */}
        <button onClick={onClick} className="text-left after:absolute after:inset-0 after:content-[''] focus:outline-none">
          {course.title}
        </button>
      </h3>
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{course.description}</p>

      <div className="mt-3 flex items-center gap-1.5 text-sm">
        {course.ratingCount > 0 ? (
          <>
            <span className="font-bold text-sun-700">{course.rating.toFixed(1)}</span>
            <span className="flex" aria-label={`Note ${course.rating.toFixed(1)} sur 5`}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(course.rating) ? 'text-sun-500 fill-current' : 'text-gray-200 fill-current'}`} />
              ))}
            </span>
            <span className="text-gray-400">({course.ratingCount})</span>
          </>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">Nouveau</span>
        )}
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">{course.studentsCount.toLocaleString('fr-FR')} étudiants</span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{course.lessonsCount} leçons</span>
        {course.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(course.duration)}</span>}
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 mt-4">
        <span className="flex items-center gap-2 min-w-0">
          <Avatar name={course.instructor.name} src={course.instructor.avatar} size="w-7 h-7" />
          <span className="text-sm text-gray-700 truncate">{course.instructor.name}</span>
          {course.instructor.verified && <BadgeCheck className="w-4 h-4 text-secondary-500 flex-shrink-0" aria-label="Formateur vérifié" />}
        </span>
        <span className="text-right flex-shrink-0">
          {course.originalPrice && course.originalPrice > course.price && (
            <span className="block text-xs text-gray-400 line-through">{formatPrice(course.originalPrice, course.currency)}</span>
          )}
          <span className={`block font-extrabold ${course.price ? 'text-primary-800' : 'text-secondary-600'}`}>
            {formatPrice(course.price, course.currency)}
          </span>
        </span>
      </div>
    </div>
  </article>
);
