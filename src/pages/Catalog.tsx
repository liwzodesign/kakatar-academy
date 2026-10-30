import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import { ErrorBox, Spinner } from '../components/ui';
import { useApi } from '../lib/useApi';
import type { Category, CourseSummary, Paginated } from '../types';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const category = params.get('categorie') || '';

  const query = new URLSearchParams();
  if (params.get('q')) query.set('search', params.get('q')!);
  if (category) query.set('category', category);
  const courses = useApi<Paginated<CourseSummary>>(`/courses/?${query}`);
  const categories = useApi<Category[]>('/courses/categories/');

  useEffect(() => { setSearch(params.get('q') || ''); }, [params]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h1 className="max-w-2xl text-3xl font-bold md:text-4xl">Apprenez le design et le digital, à votre rythme.</h1>
          <p className="mt-3 max-w-xl text-white/90">
            Des formations pratiques conçues à Ngaparou par l'équipe Kakatar Graphic, avec certificat à la clé.
            Paiement par Wave ou Orange Money.
          </p>
          <form
            className="mt-6 flex max-w-lg overflow-hidden rounded-lg bg-white"
            onSubmit={(e) => { e.preventDefault(); update('q', search.trim()); }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une formation…"
              aria-label="Rechercher une formation"
              className="flex-1 px-4 py-3 text-gray-900 outline-none"
            />
            <button className="bg-gray-900 px-4 text-white" aria-label="Rechercher"><Search className="h-5 w-5" /></button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {categories.data && categories.data.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => update('categorie', '')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                !category ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
            >Toutes</button>
            {categories.data.map((c) => (
              <button
                key={c.slug}
                onClick={() => update('categorie', c.slug)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                  category === c.slug ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
              >{c.name}</button>
            ))}
          </div>
        )}

        {courses.loading && <Spinner />}
        {courses.error && <ErrorBox error={courses.error} onRetry={courses.reload} />}
        {courses.data && courses.data.results.length === 0 && (
          <p className="py-16 text-center text-gray-500">Aucune formation ne correspond à votre recherche.</p>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data?.results.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      </div>
    </>
  );
}
