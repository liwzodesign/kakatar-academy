import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'kakatar_install_dismissed';

/** Proposition d'installer l'application (Android / Chrome), discrète et refusable durablement. */
export const InstallPrompt: React.FC = () => {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* stockage indisponible */
    }
    if (dismissed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!event) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* stockage indisponible */
    }
    setEvent(null);
  };

  const install = async () => {
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  };

  return (
    <div role="dialog" aria-label="Installer l'application"
      className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-white rounded-2xl shadow-lift ring-1 ring-gray-100 p-4 flex items-center gap-3">
      <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm">Installer Kakatar Academy</p>
        <p className="text-xs text-gray-500">Accès direct depuis votre écran d'accueil, même avec une connexion faible.</p>
      </div>
      <button onClick={install} className="flex items-center gap-1.5 bg-primary-700 text-white text-sm font-semibold px-3 py-2 rounded-xl">
        <Download className="w-4 h-4" />Installer
      </button>
      <button onClick={dismiss} aria-label="Plus tard" className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </div>
  );
};
