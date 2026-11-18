export const formatPrice = (price: number, currency = 'XOF') => {
  if (!price) return 'Gratuit';
  const amount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(price);
  return `${amount} ${currency === 'XOF' ? 'FCFA' : currency}`;
};

/** Montant d'argent (solde, revenus, versements) : affiche « 0 FCFA », jamais « Gratuit ». */
export const formatMoney = (amount: number, currency = 'XOF') =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount || 0)} ${currency === 'XOF' ? 'FCFA' : currency}`;

export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};

export const formatDate = (date: Date, withTime = false) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: withTime ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);

export const LEVEL_LABELS: Record<string, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  AVANCE: 'Avancé',
};

export const LEVEL_COLORS: Record<string, string> = {
  DEBUTANT: 'bg-green-100 text-green-800',
  INTERMEDIAIRE: 'bg-yellow-100 text-yellow-800',
  AVANCE: 'bg-red-100 text-red-800',
};

export const initials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
