import React, { useState } from 'react';
import { Search, Filter, Grid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { CourseCard } from './CourseCard';
import { useCourses } from '../../hooks/useCourses';
import { Course } from '../../types';
import { CourseCardSkeleton, EmptyState, ErrorBox } from '../UI';

interface CourseCatalogProps {
  onCourseSelect?: (course: Course) => void;
  initialSearch?: string;
  initialCategory?: string;
}

const select = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent';

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onCourseSelect, initialSearch = '', initialCategory = '' }) => {
  const {
    courses, count, page, setPage, pageCount, loading, error, searchTerm, setSearchTerm, selectedCategory,
    setSelectedCategory, selectedLevel, setSelectedLevel, priceFilter, setPriceFilter, ordering, setOrdering, categories,
  } = useCourses(initialSearch, initialCategory);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Catalogue des cours</h1>
            {!error && <p className="text-gray-600 mt-1">{count} cours disponibles</p>}
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative flex-1 lg:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un cours, un formateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filtres</span>
            </button>

            <div className="hidden sm:flex items-center border border-gray-300 rounded-lg">
              <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Toutes
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.slug)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === c.slug ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {c.name} <span className="opacity-70">({c.coursesCount})</span>
              </button>
            ))}
          </div>
        )}

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Niveau</label>
                <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className={select}>
                  <option value="">Tous les niveaux</option>
                  <option value="DEBUTANT">Débutant</option>
                  <option value="INTERMEDIAIRE">Intermédiaire</option>
                  <option value="AVANCE">Avancé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prix</label>
                <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as any)} className={select}>
                  <option value="">Tous</option>
                  <option value="free">Gratuits</option>
                  <option value="paid">Payants</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
                <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={select}>
                  <option value="-published_at">Plus récents</option>
                  <option value="-students_count">Plus populaires</option>
                  <option value="-rating_average">Mieux notés</option>
                  <option value="price">Prix croissant</option>
                  <option value="-price">Prix décroissant</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setSelectedLevel('');
                    setSearchTerm('');
                    setPriceFilter('');
                    setOrdering('-published_at');
                  }}
                  className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : error ? null : courses.length === 0 ? (
        <EmptyState title="Aucun cours ne correspond" text="Essayez un autre mot-clé ou retirez des filtres." action={
          <button onClick={() => { setSearchTerm(''); setSelectedCategory(''); setSelectedLevel(''); setPriceFilter(''); }} className="text-primary-700 font-semibold">
            Réinitialiser la recherche
          </button>
        } />
      ) : (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} onClick={() => onCourseSelect?.(course)} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center space-x-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 border rounded-lg disabled:opacity-40">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {pageCount}
          </span>
          <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="p-2 border rounded-lg disabled:opacity-40">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
