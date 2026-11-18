import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Search, ChevronRight, Plus, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, unwrap } from '../../lib/api';
import { formatPrice, LEVEL_LABELS } from '../../lib/format';
import { mapSession } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { Session } from '../../types';
import { Avatar, EmptyState, ErrorBox, Modal, Spinner, buttonPrimary, inputClass } from '../UI';
import { Badge, ProgressBar, Tabs } from '../UI/kit';

const TYPE_LABELS: Record<string, string> = { ONLINE: 'En ligne', PRESENTIAL: 'Présentiel', HYBRID: 'Hybride' };

const SessionForm: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '', description: '', type: 'ONLINE', start_at: '', duration: 60, location: '', capacity: 20, price: 0, level: 'DEBUTANT', cohort: '',
  });
  const [cohorts, setCohorts] = useState<{ id: string; title: string; course: { title: string }; status: string }[]>([]);
  useEffect(() => { api.get('/cohorts/instructor/').then((list) => setCohorts(list.filter((c: { status: string }) => c.status !== 'CANCELLED'))).catch(() => setCohorts([])); }, []);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/sessions/create/', { ...form, cohort: form.cohort || null, price: form.cohort ? 0 : form.price, start_at: new Date(form.start_at).toISOString() });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title="Programmer une session" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputClass} placeholder="Titre" value={form.title} onChange={set('title')} required />
        <textarea className={inputClass} placeholder="Description" rows={3} value={form.description} onChange={set('description')} required />
        <div className="grid grid-cols-2 gap-3">
          <select className={inputClass} value={form.type} onChange={set('type')}>
            <option value="ONLINE">En ligne</option>
            <option value="PRESENTIAL">Présentiel</option>
            <option value="HYBRID">Hybride</option>
          </select>
          <select className={inputClass} value={form.level} onChange={set('level')}>
            <option value="DEBUTANT">Débutant</option>
            <option value="INTERMEDIAIRE">Intermédiaire</option>
            <option value="AVANCE">Avancé</option>
          </select>
        </div>
        <input type="datetime-local" className={inputClass} value={form.start_at} onChange={set('start_at')} required />
        {cohorts.length > 0 && (
          <label className="block text-sm">Réservée à une promotion
            <select className={inputClass} value={form.cohort} onChange={set('cohort')}>
              <option value="">Non — session ouverte à tous</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.course.title}</option>)}
            </select>
          </label>
        )}
        {form.type !== 'ONLINE' && <input className={inputClass} placeholder="Adresse" value={form.location} onChange={set('location')} required />}
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">Durée (min)<input type="number" min={15} className={inputClass} value={form.duration} onChange={set('duration')} /></label>
          <label className="text-sm">Places<input type="number" min={1} className={inputClass} value={form.capacity} onChange={set('capacity')} /></label>
          <label className="text-sm">Prix (FCFA)<input type="number" min={0} step={500} className={inputClass} value={form.cohort ? 0 : form.price} disabled={!!form.cohort} onChange={set('price')} /></label>
        </div>
        {form.type !== 'PRESENTIAL' && <p className="text-xs text-gray-500">Une salle de visioconférence sécurisée est créée automatiquement.</p>}
        {error && <ErrorBox message={error} />}
        <button className={`${buttonPrimary} w-full`}>Programmer</button>
      </form>
    </Modal>
  );
};

export const SessionList: React.FC = () => {
  const { authState } = useAuth();
  const isInstructor = authState.user?.role === 'FORMATEUR' || authState.user?.role === 'ADMIN';
  const [tab, setTab] = useState<'upcoming' | 'mine'>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: sessions, loading, error, reload } = useApi(async () => {
    if (tab === 'mine') {
      if (isInstructor) return unwrap(await api.get('/sessions/mine/')).map(mapSession);
      return unwrap(await api.get('/sessions/registrations/')).map((r: any) => mapSession(r.session));
    }
    return unwrap(await api.get('/sessions/', { search: searchTerm, type: selectedType, level: selectedLevel })).map(mapSession);
  }, [tab, searchTerm, selectedType, selectedLevel, isInstructor]);


  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sessions en direct</h1>
            <p className="text-gray-600 mt-1">Ateliers en ligne et en présentiel avec nos formateurs</p>
          </div>
          {isInstructor && (
            <button onClick={() => setShowForm(true)} className={`${buttonPrimary} flex items-center space-x-2`}><Plus className="w-4 h-4" /><span>Programmer une session</span></button>
          )}
        </div>
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'upcoming', label: 'À venir' },
          { value: 'mine', label: isInstructor ? 'Mes sessions animées' : 'Mes inscriptions' },
        ]} />
        {tab === 'upcoming' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher…" className={`${inputClass} pl-10`} />
            </div>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={inputClass}>
              <option value="">Tous les formats</option>
              <option value="ONLINE">En ligne</option>
              <option value="PRESENTIAL">Présentiel</option>
              <option value="HYBRID">Hybride</option>
            </select>
            <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className={inputClass}>
              <option value="">Tous les niveaux</option>
              <option value="DEBUTANT">Débutant</option>
              <option value="INTERMEDIAIRE">Intermédiaire</option>
              <option value="AVANCE">Avancé</option>
            </select>
          </div>
        )}
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? (
        <Spinner />
      ) : !sessions?.length ? (
        <EmptyState title="Aucune session" text={tab === 'mine' ? 'Rien de prévu pour le moment.' : 'Revenez bientôt : de nouvelles sessions sont programmées régulièrement.'} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sessions.map((session: Session) => (
            <motion.button
              key={session.id}
              whileHover={{ y: -3 }}
              onClick={() => navigate(`/sessions/${session.id}`)}
              className="text-left bg-white rounded-2xl shadow-card ring-1 ring-gray-100 p-5 sm:p-6 hover:shadow-lift transition-shadow flex flex-col"
            >
              <div className="flex items-start gap-4">
                <span className="text-center rounded-2xl bg-primary-50 text-primary-800 w-16 py-2.5 flex-shrink-0 leading-none">
                  <span className="block text-2xl font-extrabold">{session.date.getDate()}</span>
                  <span className="block text-[11px] font-bold uppercase mt-1">{session.date.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  <span className="block text-[11px] text-primary-500 mt-1">{session.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={session.type === 'ONLINE' ? 'sky' : session.type === 'HYBRID' ? 'rose' : 'secondary'}>{TYPE_LABELS[session.type]}</Badge>
                    <Badge tone="gray">{LEVEL_LABELS[session.level]}</Badge>
                    {session.isRegistered && <Badge tone="primary">Inscrit</Badge>}
                    {session.status === 'CANCELLED' && <Badge tone="danger">Annulée</Badge>}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-gray-900 leading-snug line-clamp-2">{session.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-gray-600 text-sm line-clamp-2">{session.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{session.duration} min</span>
                <span className="flex items-center gap-1.5 min-w-0">{session.type === 'ONLINE' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}<span className="truncate max-w-[14rem]">{session.location}</span></span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{session.registrations}/{session.capacity} inscrits</span>{session.spotsLeft <= 5 && session.spotsLeft > 0 && <span className="font-semibold text-sun-700">Plus que {session.spotsLeft} place(s)</span>}</div>
                <ProgressBar value={(session.registrations / session.capacity) * 100} tone="secondary" />
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 mt-5">
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar name={session.instructor.name} src={session.instructor.avatar} size="w-8 h-8" />
                  <span className="text-sm font-medium text-gray-800 truncate">{session.instructor.name}</span>
                </span>
                <span className="flex items-center gap-1 font-extrabold text-primary-800">{formatPrice(session.price, session.currency)}<ChevronRight className="w-4 h-4 text-gray-400" /></span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {showForm && <SessionForm onClose={() => setShowForm(false)} onCreated={() => { setTab('mine'); reload(); }} />}
    </div>
  );
};
