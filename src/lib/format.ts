export const formatPrice = (price: string | number, currency = 'XOF') => {
  const n = Number(price);
  if (!n) return 'Gratuit';
  const amount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
  return currency === 'XOF' ? `${amount} FCFA` : `${amount} ${currency}`;
};

export const formatDuration = (minutes: number) => {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
};

export const LEVELS: Record<string, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  AVANCE: 'Avancé',
};
