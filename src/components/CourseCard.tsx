import { Link } from 'react-router-dom';
import { BookOpen, Clock, Users } from 'lucide-react';
import type { CourseSummary } from '../types';
import { formatDuration, formatPrice, LEVELS } from '../lib/format';

export default function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      to={`/formations/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden"
        style={{ background: course.category?.color || '#E85D04' }}>
        {course.thumbnail ? (
          <img src={course.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-lg font-bold text-white/95">
            {course.title}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-800">
          {LEVELS[course.level] || course.level}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{course.category?.name}</p>
        <h3 className="mt-1 font-semibold text-gray-900 group-hover:text-brand-700">{course.title}</h3>
        {course.short_description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">{course.short_description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{course.lessons_count} leçons</span>
          {course.duration > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(course.duration)}</span>
          )}
          {course.students_count > 0 && (
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{course.students_count}</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-sm text-gray-600">{course.instructor?.name}</span>
          <span className="font-bold text-gray-900">{formatPrice(course.price, course.currency)}</span>
        </div>
      </div>
    </Link>
  );
}
