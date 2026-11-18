import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play, Square } from 'lucide-react';

const SPEEDS = [0.8, 1, 1.25, 1.5];

/** Texte brut d'un contenu HTML (pour la synthèse vocale). */
export const htmlToText = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li)>/gi, '.\n');
  return (div.textContent || '').replace(/\.\s*\./g, '.').trim();
};

/** Découpe en phrases : les navigateurs coupent parfois les textes longs. */
const chunks = (text: string) => text.match(/[^.!?\n]+[.!?\n]*/g)?.map((s) => s.trim()).filter(Boolean) || [];

/**
 * « Écouter la leçon » : lecture à voix haute par le téléphone lui-même (synthèse vocale du navigateur).
 * Aucune donnée consommée, fonctionne hors connexion.
 */
export const ListenButton: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const queue = useRef<string[]>([]);
  const index = useRef(0);
  const active = useRef(false);

  const stop = () => {
    active.current = false;
    if (supported) window.speechSynthesis.cancel();
    setState('idle');
    setProgress(0);
  };

  // Arrêt quand on change de leçon ou quitte la page
  useEffect(() => stop, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported || !text.trim()) return null;

  const speakFrom = (i: number, rate: number) => {
    window.speechSynthesis.cancel();
    index.current = i;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang.startsWith('fr'));
    const next = () => {
      if (!active.current) return;
      if (index.current >= queue.current.length) return stop();
      const u = new SpeechSynthesisUtterance(queue.current[index.current]);
      u.lang = 'fr-FR';
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = () => {
        index.current += 1;
        setProgress(Math.round((index.current / queue.current.length) * 100));
        next();
      };
      window.speechSynthesis.speak(u);
    };
    active.current = true;
    next();
  };

  const play = () => {
    if (state === 'paused') {
      window.speechSynthesis.resume();
      return setState('playing');
    }
    queue.current = chunks(text);
    setState('playing');
    speakFrom(0, speed);
  };

  const changeSpeed = () => {
    const rate = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(rate);
    if (state === 'playing') speakFrom(index.current, rate);
  };

  if (state === 'idle') {
    return (
      <button onClick={play} className={`flex items-center gap-1.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 ${className}`}>
        <Headphones className="w-4 h-4" />Écouter la leçon
      </button>
    );
  }
  return (
    <div className={`flex items-center gap-1 bg-primary-700 text-white rounded-full pl-3 pr-1 py-1 ${className}`} role="group" aria-label="Lecture audio">
      <Headphones className="w-4 h-4 text-secondary-300" />
      <span className="text-xs font-semibold tabular-nums w-9 text-center">{progress} %</span>
      <button onClick={() => (state === 'playing' ? (window.speechSynthesis.pause(), setState('paused')) : play())}
        aria-label={state === 'playing' ? 'Pause' : 'Reprendre'} className="p-1.5 rounded-full hover:bg-white/15">
        {state === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <button onClick={changeSpeed} aria-label="Vitesse de lecture" className="px-2 py-1 rounded-full text-xs font-bold hover:bg-white/15">×{speed}</button>
      <button onClick={stop} aria-label="Arrêter" className="p-1.5 rounded-full hover:bg-white/15"><Square className="w-3.5 h-3.5" /></button>
    </div>
  );
};
