import { useEffect, useState } from 'react';
import { api, unwrap } from '../lib/api';
import { mapCourse } from '../lib/mappers';
import { Category, Course } from '../types';

/** Catalogue : recherche, filtres et pagination côté serveur. */
export const useCourses = (initialSearch = '', initialCategory = '') => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [priceFilter, setPriceFilter] = useState<'' | 'free' | 'paid'>('');
  const [ordering, setOrdering] = useState('-published_at');

  useEffect(() => setSearchTerm(initialSearch), [initialSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    api.get('/courses/categories/').then((data) =>
      setCategories(unwrap(data).map((c: any) => ({
        id: c.id, name: c.name, slug: c.slug, color: c.color, icon: c.icon, coursesCount: c.courses_count,
      })))
    ).catch(() => undefined);
  }, []);

  useEffect(() => setPage(1), [debouncedSearch, selectedCategory, selectedLevel, priceFilter, ordering]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/courses/', {
      search: debouncedSearch,
      category: selectedCategory,
      level: selectedLevel,
      free: priceFilter === 'free' ? 'true' : undefined,
      price_min: priceFilter === 'paid' ? 1 : undefined,
      ordering,
      page,
      page_size: 12,
    })
      .then((data) => {
        if (cancelled) return;
        setCourses(unwrap(data).map(mapCourse));
        setCount(data.count ?? unwrap(data).length);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedCategory, selectedLevel, priceFilter, ordering, page]);

  return {
    courses,
    count,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(count / 12)),
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    priceFilter,
    setPriceFilter,
    ordering,
    setOrdering,
    categories,
    levels: ['DEBUTANT', 'INTERMEDIAIRE', 'AVANCE'],
  };
};
