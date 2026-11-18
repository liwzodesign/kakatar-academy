/**
 * Mode économie de données : vidéo en plus basse qualité, chargée seulement à la demande.
 * Activé automatiquement si le téléphone le demande (« Économiseur de données ») ou sur réseau 2G/3G lent,
 * sauf si l'utilisateur a fait un choix explicite.
 */
import { useEffect, useState } from 'react';

const KEY = 'kakatar_data_saver';
const EVENT = 'kakatar:data-saver';

type Connection = { saveData?: boolean; effectiveType?: string };

function autoDetect(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  return !!connection && (connection.saveData === true || ['slow-2g', '2g', '3g'].includes(connection.effectiveType || ''));
}

export function isDataSaverOn(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === '1';
  } catch {
    /* stockage indisponible */
  }
  return autoDetect();
}

export function setDataSaver(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* stockage indisponible : réglage limité à la page */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDataSaver(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(isDataSaverOn);
  useEffect(() => {
    const update = () => setOn(isDataSaverOn());
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return [on, setDataSaver];
}
