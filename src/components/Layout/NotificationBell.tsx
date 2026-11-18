import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, unwrap } from '../../lib/api';
import { navigate } from '../../lib/router';

interface Notification {
  id: string;
  kind: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const ICONS: Record<string, string> = {
  PAYMENT: '💳', ENROLLMENT: '📚', COURSE: '🎓', CERTIFICATE: '🏆', SESSION: '📅', ORDER: '📦', REVIEW: '⭐',
  COMMUNITY: '💬', ACCOUNT: '🔐',
};

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
};

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api.get('/notifications/unread-count/').then((d) => setUnread(d.unread)).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => document.visibilityState === 'visible' && refreshCount(), 60000);
    return () => clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    api.get('/notifications/', { page_size: 15 }).then((d) => setItems(unwrap(d))).catch(() => undefined);
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markAll = async () => {
    await api.post('/notifications/mark-read/', {});
    setItems(items.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const openItem = async (n: Notification) => {
    if (!n.is_read) {
      api.post('/notifications/mark-read/', { ids: [n.id] }).catch(() => undefined);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} title="Notifications" className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative">
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-semibold text-gray-900">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-primary-600 flex items-center space-x-1"><CheckCheck className="w-4 h-4" /><span>Tout marquer comme lu</span></button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {items.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Aucune notification</p>}
              {items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex space-x-3 ${n.is_read ? '' : 'bg-primary-50/60'}`}>
                  <span className="text-lg">{ICONS[n.kind] || '🔔'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                    {n.message && <span className="block text-xs text-gray-600 line-clamp-2">{n.message}</span>}
                    <span className="block text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="w-2 h-2 bg-primary-600 rounded-full mt-2 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
