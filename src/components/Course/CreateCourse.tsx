import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Upload, Video, FileText, HelpCircle, Save, Eye, Sparkles, ChevronDown, ChevronUp, CheckCircle,
  CheckCircle2, Circle, Check, ChevronLeft, Layers, Gift, Wallet, Repeat, Rocket,
} from 'lucide-react';
import { api, request, unwrap } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useAuth } from '../../hooks/useAuth';
import { Category, QuizQuestion } from '../../types';
import { ErrorBox, Spinner, SuccessBox, buttonPrimary, buttonSecondary, inputClass } from '../UI';
import { Badge, Field, FileDrop, IconButton, Section } from '../UI/kit';
import { CourseCard } from './CourseCard';
import { FALLBACK_THUMBNAIL } from '../../lib/mappers';
import { formatPrice } from '../../lib/format';

interface ApiLesson {
  id: string;
  title: string;
  description: string;
  type: string;
  content: string;
  video_url: string;
  video_status: string;
  estimated_duration: number;
  is_free: boolean;
  status: string;
  quiz: QuizQuestion[];
  order: number;
}
interface ApiModule { id: string; title: string; description: string; is_free: boolean; lessons: ApiLesson[] }

const emptyInfo = {
  title: '', subtitle: '', short_description: '', description: '', category: '', level: 'DEBUTANT', language: 'fr',
  thumbnail_url: '', preview_video: '', objectives: '', requirements: '', type: 'PAID', price: '0',
  original_price: '', certificate_available: true, allow_reviews: true, max_students: '', status: 'DRAFT',
};

const steps = [
  { id: 1, title: 'Informations', description: 'Présentation du cours' },
  { id: 2, title: 'Programme', description: 'Modules et leçons' },
  { id: 3, title: 'Prix', description: 'Tarif et options' },
  { id: 4, title: 'Publication', description: 'Vérifier et publier' },
];

const LessonEditor: React.FC<{ lesson: ApiLesson; onChanged: () => void }> = ({ lesson, onChanged }) => {
  const [form, setForm] = useState(lesson);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(lesson), [lesson]);

  const save = async () => {
    setBusy('save');
    setError('');
    try {
      await api.patch(`/courses/lessons/${lesson.id}/`, {
        title: form.title, description: form.description, type: form.type, content: form.content,
        video_url: form.video_url, estimated_duration: Number(form.estimated_duration) || 0, is_free: form.is_free,
        status: form.status, quiz: form.quiz,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer la leçon « ${lesson.title} » ?`)) return;
    await api.delete(`/courses/lessons/${lesson.id}/`);
    onChanged();
  };

  const uploadVideo = async (file: File) => {
    setBusy('upload');
    setError('');
    const body = new FormData();
    body.append('video', file);
    try {
      await request(`/courses/lessons/${lesson.id}/video/`, { method: 'POST', body });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  const generateQuiz = async () => {
    setBusy('quiz');
    setError('');
    try {
      const res = await api.post(`/ai/lessons/${lesson.id}/quiz/`, { num_questions: 5 });
      setForm({ ...form, type: 'QUIZ', quiz: res.questions });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  const setQuestion = (qi: number, patch: Partial<QuizQuestion>) =>
    setForm({ ...form, quiz: form.quiz.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });

  const Icon = form.type === 'VIDEO' ? Video : form.type === 'QUIZ' ? HelpCircle : FileText;

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-left">
        <span className="flex items-center space-x-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{form.title}</span>
          {form.status !== 'PUBLISHED' && <span className="text-xs bg-gray-100 px-2 rounded">brouillon</span>}
          {form.video_status && form.video_status !== 'NONE' && <span className="text-xs bg-primary-50 text-primary-700 px-2 rounded">vidéo : {form.video_status.toLowerCase()}</span>}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={`${inputClass} md:col-span-2`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre" />
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="VIDEO">Vidéo</option>
              <option value="TEXT">Texte</option>
              <option value="QUIZ">Quiz</option>
              <option value="PROJECT">Projet</option>
              <option value="RESOURCE">Ressource</option>
            </select>
          </div>
          <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description courte" />

          {form.type === 'VIDEO' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={inputClass} value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="URL vidéo (YouTube, Vimeo, MP4…)" />
              <label className={`${buttonSecondary} flex items-center justify-center space-x-2 cursor-pointer`}>
                <Upload className="w-4 h-4" />
                <span>{busy === 'upload' ? 'Téléversement…' : 'Ou téléverser un fichier'}</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
              </label>
            </div>
          )}

          <textarea className={inputClass} rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder={form.type === 'QUIZ' ? 'Contenu de référence (utilisé pour générer le quiz)' : 'Contenu de la leçon (texte ou HTML simple)'} />

          {form.type === 'QUIZ' && (
            <div className="space-y-3 bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">Questions ({form.quiz.length})</p>
                <div className="flex space-x-2">
                  <button onClick={generateQuiz} disabled={!!busy} className="flex items-center space-x-1 text-sm bg-secondary-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                    <Sparkles className="w-4 h-4" /><span>{busy === 'quiz' ? 'Génération…' : 'Générer avec l\'IA'}</span>
                  </button>
                  <button onClick={() => setForm({ ...form, quiz: [...form.quiz, { question: '', options: ['', ''], answer: 0 }] })} className="text-sm border px-3 py-1 rounded-lg bg-white">+ Question</button>
                </div>
              </div>
              {form.quiz.map((q, qi) => (
                <div key={qi} className="bg-white rounded-lg p-3 space-y-2 border">
                  <div className="flex space-x-2">
                    <input className={inputClass} value={q.question} onChange={(e) => setQuestion(qi, { question: e.target.value })} placeholder={`Question ${qi + 1}`} />
                    <button onClick={() => setForm({ ...form, quiz: form.quiz.filter((_, i) => i !== qi) })} className="text-red-500 px-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center space-x-2">
                      <input type="radio" checked={q.answer === oi} onChange={() => setQuestion(qi, { answer: oi })} title="Bonne réponse" />
                      <input className={inputClass} value={opt} onChange={(e) => setQuestion(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} placeholder={`Option ${oi + 1}`} />
                    </div>
                  ))}
                  <button onClick={() => setQuestion(qi, { options: [...q.options, ''] })} className="text-xs text-primary-600">+ option</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} /><span>Aperçu gratuit</span></label>
            <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={form.status === 'PUBLISHED'} onChange={(e) => setForm({ ...form, status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })} /><span>Visible</span></label>
            <label className="flex items-center space-x-2 text-sm">
              <span>Durée (min)</span>
              <input type="number" min={0} className="w-20 px-2 py-1 border rounded" value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: Number(e.target.value) })} />
            </label>
            <div className="flex-1" />
            <button onClick={remove} className="text-red-600 text-sm flex items-center space-x-1"><Trash2 className="w-4 h-4" /><span>Supprimer</span></button>
            <button onClick={save} disabled={!!busy} className={`${buttonPrimary} flex items-center space-x-1`}>
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}<span>{saved ? 'Enregistré' : 'Enregistrer'}</span>
            </button>
          </div>
          {error && <ErrorBox message={error} />}
        </div>
      )}
    </div>
  );
};

export const CreateCourse: React.FC<{ slug?: string }> = ({ slug: initialSlug }) => {
  const { authState } = useAuth();
  const [slug, setSlug] = useState(initialSlug || '');
  const [currentStep, setCurrentStep] = useState(1);
  const [info, setInfo] = useState(emptyInfo);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState('');
  const [thumbPreviewServer, setThumbPreviewServer] = useState('');
  const [modules, setModules] = useState<ApiModule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!!initialSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newModule, setNewModule] = useState('');

  const isVerified = authState.user?.verificationStatus === 'VERIFIED' || authState.user?.role === 'ADMIN';

  useEffect(() => {
    api.get('/courses/categories/').then((d) => setCategories(unwrap(d).map((c: any) => ({ ...c, coursesCount: c.courses_count }))));
  }, []);

  const loadCourse = async (s: string) => {
    const c = await api.get(`/courses/${s}/`);
    setInfo({
      title: c.title, subtitle: c.subtitle || '', short_description: c.short_description || '', description: c.description,
      category: String(c.category?.id || ''), level: c.level, language: c.language || 'fr',
      thumbnail_url: c.thumbnail && !c.thumbnail.includes('/media/') ? c.thumbnail : '', preview_video: c.preview_video || '',
      objectives: (c.objectives || []).join('\n'), requirements: (c.requirements || []).join('\n'), type: c.type,
      price: String(Number(c.price)), original_price: c.original_price ? String(Number(c.original_price)) : '',
      certificate_available: c.certificate_available, allow_reviews: c.allow_reviews,
      max_students: c.max_students ? String(c.max_students) : '', status: c.status,
    });
    setModules(c.modules);
    if (c.thumbnail && c.thumbnail.includes('/media/')) setThumbPreviewServer(c.thumbnail);
  };

  useEffect(() => {
    if (!initialSlug) return;
    loadCourse(initialSlug).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [initialSlug]);

  useEffect(() => {
    if (!thumbnailFile) return setThumbPreview('');
    const url = URL.createObjectURL(thumbnailFile);
    setThumbPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnailFile]);

  const reloadModules = () => slug && api.get(`/courses/${slug}/`).then((c) => setModules(c.modules));

  const payload = (extra: Record<string, any> = {}) => {
    const data: Record<string, any> = {
      title: info.title, subtitle: info.subtitle, short_description: info.short_description, description: info.description,
      category: info.category, level: info.level, language: info.language, thumbnail_url: info.thumbnail_url,
      preview_video: info.preview_video,
      objectives: info.objectives.split('\n').map((s) => s.trim()).filter(Boolean),
      requirements: info.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
      type: Number(info.price) > 0 ? (info.type === 'FREE' ? 'PAID' : info.type) : info.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'FREE',
      price: info.price || '0', original_price: info.original_price || null,
      certificate_available: info.certificate_available, allow_reviews: info.allow_reviews,
      max_students: info.max_students || null, ...extra,
    };
    if (!thumbnailFile) return data;
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    form.append('thumbnail', thumbnailFile);
    return form;
  };

  const saveInfo = async (extra: Record<string, any> = {}) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = payload(extra);
      // Les listes JSON ne passent pas en multipart : on les renvoie en JSON juste après
      const res = slug
        ? await request(`/courses/${slug}/update/`, { method: 'PATCH', body })
        : await request('/courses/create/', { method: 'POST', body });
      if (body instanceof FormData) {
        const json = payload() as Record<string, any>;
        await api.patch(`/courses/${res.slug}/update/`, {
          objectives: json.objectives, requirements: json.requirements,
        });
        setThumbnailFile(null);
      }
      if (!slug) {
        setSlug(res.slug);
        window.history.replaceState({}, '', `/edit-course/${res.slug}`);
      }
      if (extra.status) setInfo((i) => ({ ...i, status: extra.status }));
      setNotice('Modifications enregistrées');
      return res;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (currentStep === 1 || currentStep === 3) {
      if (!info.title || !info.description || !info.category) return setError('Titre, description et catégorie sont obligatoires.');
      if (!(await saveInfo())) return;
    }
    setNotice('');
    setCurrentStep(Math.min(4, currentStep + 1));
  };

  const addModule = async () => {
    if (!newModule.trim()) return;
    await api.post(`/courses/${slug}/modules/create/`, { title: newModule.trim() });
    setNewModule('');
    reloadModules();
  };

  const addLesson = async (moduleId: string) => {
    await api.post(`/courses/modules/${moduleId}/lessons/create/`, { title: 'Nouvelle leçon', type: 'TEXT', status: 'DRAFT' });
    reloadModules();
  };

  const deleteModule = async (m: ApiModule) => {
    if (!confirm(`Supprimer le module « ${m.title} » et ses leçons ?`)) return;
    await api.delete(`/courses/modules/${m.id}/`);
    reloadModules();
  };

  if (loading) return <Spinner />;

  const set = (key: keyof typeof info) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setInfo({ ...info, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const lessonsCount = modules.reduce((n, m) => n + m.lessons.length, 0);

  const previewCourse = {
    id: 'apercu', title: info.title || 'Titre de votre cours', slug: slug || 'apercu',
    description: info.short_description || info.description || 'La description courte apparaîtra ici.',
    thumbnail: thumbPreview || info.thumbnail_url || FALLBACK_THUMBNAIL, price: Number(info.price) || 0,
    originalPrice: info.original_price ? Number(info.original_price) : null, currency: 'XOF', priceDisplay: '',
    discountPercentage: info.original_price && Number(info.original_price) > Number(info.price)
      ? Math.round((1 - Number(info.price) / Number(info.original_price)) * 100) : 0,
    type: info.type as any, level: info.level as any,
    category: categories.find((c) => String(c.id) === String(info.category))?.name || 'Catégorie',
    duration: modules.reduce((n, m) => n + m.lessons.reduce((k, l) => k + (Number(l.estimated_duration) || 0), 0), 0),
    lessonsCount, rating: 0, ratingCount: 0, studentsCount: 0, completionRate: 0,
    instructor: { id: '', name: authState.user?.name || '', verified: isVerified }, status: info.status as any,
    tags: [], createdAt: new Date(), updatedAt: new Date(),
  };

  const checklist = [
    { ok: !!info.title && !!info.description && !!info.category, label: 'Titre, description et catégorie' },
    { ok: !!(thumbnailFile || info.thumbnail_url || thumbPreviewServer), label: 'Image de couverture' },
    { ok: modules.length > 0, label: 'Au moins un module' },
    { ok: lessonsCount > 0, label: 'Au moins une leçon' },
    { ok: isVerified, label: 'Compte formateur vérifié' },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <Section title="L'essentiel" description="Ce que les apprenants voient en premier dans le catalogue.">
              <div className="space-y-5">
                <Field label="Titre du cours" required hint="Court et précis : le résultat que l'apprenant obtiendra.">
                  <input className={inputClass} value={info.title} onChange={set('title')} placeholder="Ex. : Créez votre site web de A à Z" />
                </Field>
                <Field label="Sous-titre">
                  <input className={inputClass} value={info.subtitle} onChange={set('subtitle')} placeholder="Une phrase d'accroche" />
                </Field>
                <Field label="Description courte" hint={`${info.short_description.length}/500 caractères — affichée sur la carte du cours.`}>
                  <input className={inputClass} maxLength={500} value={info.short_description} onChange={set('short_description')} />
                </Field>
                <Field label="Description complète" required>
                  <textarea className={inputClass} rows={6} value={info.description} onChange={set('description')} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Catégorie" required>
                    <select className={inputClass} value={info.category} onChange={set('category')}>
                      <option value="">Choisir…</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Niveau">
                    <select className={inputClass} value={info.level} onChange={set('level')}>
                      <option value="DEBUTANT">Débutant</option>
                      <option value="INTERMEDIAIRE">Intermédiaire</option>
                      <option value="AVANCE">Avancé</option>
                    </select>
                  </Field>
                  <Field label="Langue">
                    <select className={inputClass} value={info.language} onChange={set('language')}>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                      <option value="wo">Wolof</option>
                    </select>
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Pédagogie" description="Une ligne par point.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Ce que l'on apprend">
                  <textarea className={inputClass} rows={5} value={info.objectives} onChange={set('objectives')} placeholder={'Concevoir une page web\nPublier son site en ligne'} />
                </Field>
                <Field label="Prérequis">
                  <textarea className={inputClass} rows={5} value={info.requirements} onChange={set('requirements')} placeholder={'Un ordinateur\nAucune connaissance préalable'} />
                </Field>
              </div>
            </Section>

            <Section title="Visuels">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Image de couverture" hint="Format paysage 16:9, 1280×720 conseillé.">
                  <FileDrop accept="image/*" image file={thumbnailFile} onChange={setThumbnailFile} label="Choisir une image" currentUrl={info.thumbnail_url || thumbPreviewServer} />
                  <input className={`${inputClass} mt-3`} value={info.thumbnail_url} onChange={set('thumbnail_url')} placeholder="…ou collez l'URL d'une image" />
                </Field>
                <Field label="Vidéo de présentation" hint="Lien YouTube, Vimeo ou MP4.">
                  <input className={inputClass} value={info.preview_video} onChange={set('preview_video')} placeholder="https://…" />
                </Field>
              </div>
            </Section>
          </div>
        );

      case 2:
        return (
          <Section title="Programme" description={`${modules.length} module(s) · ${lessonsCount} leçon(s). Cliquez sur une leçon pour la modifier.`}>
            <div className="space-y-4">
              {modules.length === 0 && (
                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-gray-200">
                  <Layers className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="mt-3 font-semibold text-gray-900">Structurez votre cours en modules</p>
                  <p className="text-sm text-gray-500">Par exemple : Introduction, Mise en pratique, Projet final.</p>
                </div>
              )}
              {modules.map((m, mi) => (
                <div key={m.id} className="rounded-2xl ring-1 ring-gray-200 bg-gray-50/70 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
                    <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center">{mi + 1}</span>
                    <h3 className="flex-1 font-bold text-gray-900 truncate">{m.title}</h3>
                    <Badge tone="gray">{m.lessons.length} leçon(s)</Badge>
                    <button onClick={() => addLesson(m.id)} className="flex items-center gap-1 text-sm font-semibold text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50">
                      <Plus className="w-4 h-4" />Leçon
                    </button>
                    <IconButton label="Supprimer le module" tone="danger" onClick={() => deleteModule(m)}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                  <div className="p-3 space-y-2">
                    {m.lessons.map((l) => <LessonEditor key={l.id} lesson={l} onChanged={reloadModules} />)}
                    {m.lessons.length === 0 && <p className="text-sm text-gray-500 px-2 py-3">Aucune leçon dans ce module.</p>}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input className={inputClass} value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="Titre du nouveau module"
                  onKeyDown={(e) => e.key === 'Enter' && addModule()} aria-label="Titre du nouveau module" />
                <button onClick={addModule} disabled={!newModule.trim()} className={`${buttonPrimary} flex items-center gap-1.5 whitespace-nowrap`}><Plus className="w-4 h-4" />Ajouter le module</button>
              </div>
            </div>
          </Section>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Section title="Modèle économique">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { v: 'FREE', t: 'Gratuit', d: 'Idéal pour se faire connaître', icon: Gift },
                  { v: 'PAID', t: 'Payant', d: 'Achat à l\'unité', icon: Wallet },
                  { v: 'SUBSCRIPTION', t: 'Abonnement', d: 'Inclus pour les abonnés', icon: Repeat },
                ].map((o) => {
                  const active = info.type === o.v;
                  return (
                    <label key={o.v} className={`relative p-4 rounded-2xl cursor-pointer ring-1 transition-all ${active ? 'ring-2 ring-primary-600 bg-primary-50/60' : 'ring-gray-200 hover:ring-gray-300'}`}>
                      <input type="radio" name="type" className="sr-only" checked={active} onChange={() => setInfo({ ...info, type: o.v, price: o.v === 'PAID' ? info.price : '0' })} />
                      <o.icon className={`w-6 h-6 ${active ? 'text-primary-700' : 'text-gray-400'}`} />
                      <span className="block mt-3 font-bold text-gray-900">{o.t}</span>
                      <span className="block text-sm text-gray-500">{o.d}</span>
                      {active && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary-700" />}
                    </label>
                  );
                })}
              </div>
              {info.type === 'PAID' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <Field label="Prix (FCFA)" required>
                    <input type="number" min={0} step={500} className={inputClass} value={info.price} onChange={set('price')} />
                  </Field>
                  <Field label="Prix barré" hint="Facultatif : affiche une remise.">
                    <input type="number" min={0} step={500} className={inputClass} value={info.original_price} onChange={set('original_price')} />
                  </Field>
                </div>
              )}
              {info.type === 'PAID' && Number(info.price) > 0 && (
                <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                  Pour une vente à {formatPrice(Number(info.price))}, vous recevez environ <strong>{formatPrice(Math.round(Number(info.price) * 0.85))}</strong> après la commission plateforme.
                </p>
              )}
            </Section>
            <Section title="Options">
              <div className="space-y-4">
                <Field label="Nombre maximum d'étudiants" hint="Laissez vide pour un accès illimité.">
                  <input type="number" min={1} className={`${inputClass} max-w-xs`} value={info.max_students} onChange={set('max_students')} />
                </Field>
                <Toggle checked={info.certificate_available} onChange={(v) => setInfo({ ...info, certificate_available: v })} label="Délivrer un certificat" hint="Délivré automatiquement quand toutes les leçons sont terminées." />
                <Toggle checked={info.allow_reviews} onChange={(v) => setInfo({ ...info, allow_reviews: v })} label="Autoriser les avis" hint="Les avis inappropriés sont masqués automatiquement." />
              </div>
            </Section>
          </div>
        );

      case 4:
        return (
          <Section title="Prêt à publier ?" description="Vérifiez les éléments ci-dessous avant la mise en ligne.">
            <ul className="space-y-2.5">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-3">
                  {c.ok ? <CheckCircle2 className="w-5 h-5 text-secondary-500" /> : <Circle className="w-5 h-5 text-gray-300" />}
                  <span className={c.ok ? 'text-gray-800' : 'text-gray-500'}>{c.label}</span>
                </li>
              ))}
            </ul>
            {!isVerified && (
              <div className="mt-5 bg-sun-50 ring-1 ring-sun-100 text-sun-800 rounded-xl p-4 text-sm">
                Votre compte formateur doit être vérifié pour publier.{' '}
                <button className="underline font-semibold" onClick={() => navigate('/settings?tab=verification')}>Envoyer mes justificatifs</button>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => navigate(`/courses/${slug}`)} className={`${buttonSecondary} flex items-center gap-2`}><Eye className="w-4 h-4" />Voir la page du cours</button>
              {info.status === 'PUBLISHED' ? (
                <button onClick={() => saveInfo({ status: 'DRAFT' })} disabled={saving} className={buttonSecondary}>Repasser en brouillon</button>
              ) : (
                <button onClick={() => saveInfo({ status: 'PUBLISHED' })} disabled={saving || checklist.some((c) => !c.ok && c.label !== 'Image de couverture')}
                  className={`${buttonPrimary} px-6 flex items-center gap-2`}><Rocket className="w-4 h-4" />Publier le cours</button>
              )}
            </div>
          </Section>
        );
    }
  };

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <button onClick={() => navigate('/my-courses')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Mes cours</button>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">{slug ? info.title || 'Modifier le cours' : 'Nouveau cours'}</h1>
        </div>
        {slug && <Badge tone={info.status === 'PUBLISHED' ? 'secondary' : 'gray'}>{info.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Étapes */}
        <nav aria-label="Étapes" className="lg:sticky lg:top-24 self-start">
          <ol className="flex lg:flex-col gap-1 overflow-x-auto">
            {steps.map((step) => {
              const active = currentStep === step.id;
              const done = currentStep > step.id;
              return (
                <li key={step.id} className="flex-shrink-0">
                  <button disabled={!slug && step.id > 1} onClick={() => setCurrentStep(step.id)} aria-current={active ? 'step' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-white shadow-card ring-1 ring-gray-100' : 'hover:bg-white/60'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${active ? 'bg-primary-700 text-white' : done ? 'bg-secondary-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {done ? <Check className="w-4 h-4" /> : step.id}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${active ? 'text-gray-900' : 'text-gray-600'}`}>{step.title}</span>
                      <span className="hidden lg:block text-xs text-gray-400">{step.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {error && <ErrorBox message={error} />}
          {notice && <SuccessBox message={notice} />}
          {renderStepContent()}
        </div>

        {/* Aperçu en direct */}
        <aside className="hidden xl:block self-start sticky top-24 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Aperçu dans le catalogue</p>
          <div className="pointer-events-none"><CourseCard course={previewCourse} /></div>
          <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-4 text-sm space-y-2">
            {checklist.map((c) => (
              <p key={c.label} className="flex items-center gap-2">{c.ok ? <CheckCircle2 className="w-4 h-4 text-secondary-500" /> : <Circle className="w-4 h-4 text-gray-300" />}<span className={c.ok ? 'text-gray-700' : 'text-gray-400'}>{c.label}</span></p>
            ))}
          </div>
        </aside>
      </div>

      {/* Barre d'actions */}
      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-20 bg-white/90 backdrop-blur border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <button onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1} className={buttonSecondary}>Précédent</button>
          <span className="flex-1 text-sm text-gray-500 hidden sm:block">Étape {currentStep} sur {steps.length} · enregistrement sur le serveur</span>
          <span className="flex-1 sm:hidden" />
          {currentStep < 4 && <button onClick={next} disabled={saving} className={buttonPrimary}>{saving ? 'Enregistrement…' : 'Enregistrer et continuer'}</button>}
        </div>
      </div>
    </div>
  );
};

/** Interrupteur accessible (remplace la case à cocher). */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative mt-0.5 w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-secondary-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
    <span><span className="block font-semibold text-gray-900 text-sm">{label}</span>{hint && <span className="block text-xs text-gray-500">{hint}</span>}</span>
  </label>
);
