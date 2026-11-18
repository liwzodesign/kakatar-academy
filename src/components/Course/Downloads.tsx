import React, { useEffect, useState } from 'react';
import { Download, Trash2, WifiOff, HardDrive, Gauge, PlayCircle, FileText } from 'lucide-react';
import DOMPurify from 'dompurify';
import { formatBytes, listSavedLessons, offlineSupported, offlineVideoUrl, OfflineLesson, removeLesson, storageEstimate } from '../../lib/offline';
import { useDataSaver } from '../../lib/dataSaver';
import { ListenButton, htmlToText } from './ListenButton';
import { navigate } from '../../lib/router';
import { EmptyState, Modal, PageHeader, Spinner, buttonPrimary } from '../UI';
import { Section } from '../UI/kit';

/** Lecture d'une leçon enregistrée, sans aucun appel réseau. */
const OfflineViewer: React.FC<{ lesson: OfflineLesson; onClose: () => void }> = ({ lesson, onClose }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    offlineVideoUrl(lesson.lessonId).then((u) => { url = u; setSrc(u); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [lesson.lessonId]);

  return (
    <Modal title={lesson.title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{lesson.courseTitle}</p>
        {lesson.hasVideo && (src ? <video src={src} controls playsInline className="w-full rounded-xl bg-black aspect-video" /> : <Spinner className="h-40" />)}
        {lesson.content && <ListenButton text={htmlToText(lesson.content)} className="w-fit" />}
        {lesson.content && (
          <div className="text-gray-800 leading-relaxed [&_p]:mb-3"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(/<[a-z][\s\S]*>/i.test(lesson.content) ? lesson.content : lesson.content.replace(/\n/g, '<br/>')) }} />
        )}
        {lesson.summary && <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700"><p className="font-semibold mb-1">Résumé</p>{lesson.summary}</div>}
      </div>
    </Modal>
  );
};

export const Downloads: React.FC = () => {
  const [items, setItems] = useState<OfflineLesson[] | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [open, setOpen] = useState<OfflineLesson | null>(null);
  const [dataSaver, setDataSaver] = useDataSaver();

  const load = () => {
    listSavedLessons().then(setItems);
    storageEstimate().then(setUsage);
  };
  useEffect(load, []);

  const remove = async (id: string) => {
    await removeLesson(id);
    load();
  };

  if (!offlineSupported()) {
    return <EmptyState title="Non disponible sur ce navigateur" text="Utilisez un navigateur récent (Chrome, Edge, Safari) pour enregistrer des leçons." />;
  }

  const byCourse = (items || []).reduce<Record<string, OfflineLesson[]>>((acc, l) => {
    (acc[l.courseTitle] ||= []).push(l);
    return acc;
  }, {});
  const total = (items || []).reduce((n, l) => n + l.videoBytes, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Téléchargements" subtitle="Vos leçons enregistrées sur cet appareil, consultables sans connexion." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Section>
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center"><HardDrive className="w-6 h-6" /></span>
            <div>
              <p className="font-bold text-gray-900">{total > 0 ? `${formatBytes(total)} de vidéos enregistrées` : 'Aucune vidéo enregistrée'}</p>
              {usage && usage.quota > 0 && <p className="text-sm text-gray-500">Espace disponible pour l'application : {formatBytes(Math.max(usage.quota - usage.used, 0))}</p>}
            </div>
          </div>
        </Section>
        <Section>
          <label className="flex items-center gap-4 cursor-pointer">
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${dataSaver ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-500'}`}><Gauge className="w-6 h-6" /></span>
            <span className="flex-1">
              <span className="block font-bold text-gray-900">Économie de données</span>
              <span className="block text-sm text-gray-500">Vidéos en qualité légère, chargées seulement à votre demande.</span>
            </span>
            <input type="checkbox" className="w-5 h-5 accent-primary-700" checked={dataSaver} onChange={(e) => setDataSaver(e.target.checked)} />
          </label>
        </Section>
      </div>

      {items === null ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="Aucune leçon enregistrée"
          text="Dans une leçon, touchez « Enregistrer hors connexion » pour la regarder plus tard sans réseau."
          action={<button onClick={() => navigate('/my-courses')} className={buttonPrimary}>Mes cours</button>} />
      ) : (
        Object.entries(byCourse).map(([courseTitle, lessons]) => (
          <Section key={courseTitle} title={courseTitle} description={`${lessons.length} leçon(s)`} padded={false}>
            <ul className="divide-y divide-gray-100">
              {lessons.map((l) => (
                <li key={l.lessonId} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                    {l.hasVideo ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </span>
                  <button onClick={() => setOpen(l)} className="flex-1 min-w-0 text-left">
                    <span className="block font-semibold text-gray-900 truncate">{l.title}</span>
                    <span className="block text-xs text-gray-500">
                      {l.hasVideo ? formatBytes(l.videoBytes) : 'Texte'} · enregistrée le {new Date(l.savedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </button>
                  <span className="hidden sm:flex items-center gap-1 text-xs font-semibold text-secondary-700"><WifiOff className="w-3.5 h-3.5" />Hors ligne</span>
                  <button onClick={() => remove(l.lessonId)} aria-label={`Supprimer ${l.title}`} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
      <p className="text-xs text-gray-400 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Les leçons restent sur cet appareil uniquement. Elles sont effacées si vous videz les données du navigateur.</p>
      {open && <OfflineViewer lesson={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
