import React, { useState } from 'react';
import { Calendar, CalendarPlus, Clock, MapPin, Users, Video, CheckCircle, ExternalLink } from 'lucide-react';
import { api, downloadFile, unwrap } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { mapSession } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { Session } from '../../types';
import { Avatar, Card, ErrorBox, Spinner, SuccessBox, buttonPrimary, inputClass } from '../UI';
import { CheckoutModal } from '../Payment/CheckoutModal';

/** Lien « Ajouter à Google Agenda » (sans le lien de visio, qui reste dans la plateforme). */
function googleCalendarUrl(session: Session) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const page = `${window.location.origin}/sessions/${session.id}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title,
    dates: `${fmt(session.date)}/${fmt(session.endDate)}`,
    details: `${session.description.slice(0, 500)}

Animée par ${session.instructor.name}
${page}`,
    location: session.type === 'ONLINE' ? 'En ligne — Kakatar Academy' : session.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface SessionBookingProps {
  sessionId: string;
  onRequireAuth: () => void;
}

export const SessionBooking: React.FC<SessionBookingProps> = ({ sessionId, onRequireAuth }) => {
  const { authState } = useAuth();
  const { data: session, loading, error, reload } = useApi(
    async () => mapSession(await api.get(`/sessions/${sessionId}/`)),
    [sessionId, authState.isAuthenticated]
  );
  const { data: attendees } = useApi(
    async () => (session?.isOwner ? unwrap(await api.get(`/sessions/${sessionId}/attendees/`)) : []),
    [session?.isOwner, sessionId]
  );
  const [info, setInfo] = useState({ phone: '', company: '', experience: 'DEBUTANT', expectations: '' });
  const [showCheckout, setShowCheckout] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  if (loading && !session) return <Spinner />;
  if (error || !session) return <ErrorBox message={error || 'Session introuvable'} onRetry={reload} />;

  const set = (k: keyof typeof info) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setInfo({ ...info, [k]: e.target.value });

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.isAuthenticated) return onRequireAuth();
    setActionError('');
    if (session.price > 0) return setShowCheckout(true);
    try {
      await api.post(`/sessions/${session.id}/register/`, info);
      setNotice('Inscription confirmée ! Un email de confirmation vous a été envoyé.');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const join = async () => {
    setActionError('');
    try {
      const res = await api.get(`/sessions/${session.id}/join/`);
      window.open(res.meeting_url, '_blank', 'noopener');
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const cancel = async () => {
    if (!confirm('Annuler votre inscription ?')) return;
    try {
      await api.post(`/sessions/${session.id}/cancel-registration/`);
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const cancelSession = async () => {
    if (!confirm('Annuler cette session ? Les inscrits seront prévenus par email.')) return;
    await api.delete(`/sessions/${session.id}/`);
    reload();
  };

  const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(session.date);
  const isPast = session.endDate < new Date();

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/sessions')} className="text-gray-600 hover:text-gray-900">← Retour aux sessions</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{session.title}</h1>
            {session.status === 'CANCELLED' && <ErrorBox message="Cette session a été annulée." />}
            <p className="text-gray-700 whitespace-pre-line mt-4">{session.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm text-gray-700">
              <div className="flex items-center space-x-2"><Calendar className="w-5 h-5 text-primary-600" /><span className="capitalize">{dateLabel}</span></div>
              <div className="flex items-center space-x-2"><Clock className="w-5 h-5 text-primary-600" /><span>{session.duration} minutes</span></div>
              <div className="flex items-center space-x-2">{session.type === 'ONLINE' ? <Video className="w-5 h-5 text-primary-600" /> : <MapPin className="w-5 h-5 text-primary-600" />}<span>{session.location}</span></div>
              <div className="flex items-center space-x-2"><Users className="w-5 h-5 text-primary-600" /><span>{session.spotsLeft} places restantes sur {session.capacity}</span></div>
            </div>
          </Card>

          {session.isOwner ? (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Participants ({attendees?.length || 0})</h2>
                {session.status !== 'CANCELLED' && !isPast && <button onClick={cancelSession} className="text-sm text-red-600">Annuler la session</button>}
              </div>
              {!attendees?.length ? (
                <p className="text-gray-500">Aucun inscrit pour le moment.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {attendees.map((a: any) => (
                    <div key={a.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{a.user.name}</p>
                        <p className="text-gray-500">{a.user.email}{a.phone ? ` · ${a.phone}` : ''}</p>
                        {a.expectations && <p className="text-gray-600 mt-1">« {a.expectations} »</p>}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${a.status === 'ATTENDED' ? 'bg-secondary-100 text-secondary-800' : 'bg-primary-100 text-primary-800'}`}>{a.status === 'ATTENDED' ? 'Présent' : 'Confirmé'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : session.isRegistered ? (
            <Card className="space-y-4">
              <div className="flex items-center space-x-3 text-secondary-700"><CheckCircle className="w-6 h-6" /><span className="font-semibold">Vous êtes inscrit à cette session.</span></div>
              {session.type !== 'PRESENTIAL' && !isPast && (
                <button onClick={join} className={`${buttonPrimary} flex items-center space-x-2`}><ExternalLink className="w-4 h-4" /><span>Rejoindre la salle</span></button>
              )}
              {session.recordingUrl && <a href={session.recordingUrl} target="_blank" rel="noreferrer" className="text-primary-700 font-semibold hover:underline">Voir l'enregistrement</a>}
              {!isPast && <button onClick={cancel} className="text-sm text-gray-500 underline">Annuler mon inscription</button>}
            </Card>
          ) : session.status === 'SCHEDULED' && !isPast ? (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Réserver ma place</h2>
              <form onSubmit={book} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className={inputClass} placeholder="Téléphone" value={info.phone} onChange={set('phone')} />
                  <input className={inputClass} placeholder="Entreprise / école" value={info.company} onChange={set('company')} />
                </div>
                <select className={inputClass} value={info.experience} onChange={set('experience')}>
                  <option value="DEBUTANT">Je débute sur le sujet</option>
                  <option value="INTERMEDIAIRE">J'ai quelques bases</option>
                  <option value="AVANCE">Je suis à l'aise</option>
                </select>
                <textarea className={inputClass} rows={3} placeholder="Qu'attendez-vous de cette session ?" value={info.expectations} onChange={set('expectations')} />
                {actionError && <ErrorBox message={actionError} />}
                <button disabled={session.spotsLeft === 0} className={`${buttonPrimary} w-full py-3`}>
                  {session.spotsLeft === 0 ? 'Complet' : session.price > 0 ? `Réserver — ${formatPrice(session.price, session.currency)}` : 'Réserver gratuitement'}
                </button>
              </form>
            </Card>
          ) : null}
          {notice && <SuccessBox message={notice} />}
          {actionError && session.isRegistered && <ErrorBox message={actionError} />}
        </div>

        <div className="space-y-6">
          <Card>
            <p className="text-3xl font-bold text-gray-900">{formatPrice(session.price, session.currency)}</p>
            <p className="text-sm text-gray-500">par participant</p>
            {!isPast && session.status !== 'CANCELLED' && (
              <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary-600" />Ajouter à mon agenda</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href={googleCalendarUrl(session)} target="_blank" rel="noreferrer"
                    className="text-center text-sm font-semibold px-3 py-2 rounded-xl ring-1 ring-gray-200 hover:bg-gray-50">Google Agenda</a>
                  <button onClick={() => downloadFile(`/sessions/${session.id}/calendar.ics`, 'session.ics')}
                    className="text-sm font-semibold px-3 py-2 rounded-xl ring-1 ring-gray-200 hover:bg-gray-50">Outlook / Apple</button>
                </div>
              </div>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">Animateur</h3>
            <div className="flex items-center space-x-3 mb-3">
              <Avatar name={session.instructor.name} src={session.instructor.avatar} />
              <div>
                <p className="font-medium text-gray-900">{session.instructor.name}</p>
                <p className="text-sm text-gray-500">{session.instructor.rating ? `★ ${session.instructor.rating.toFixed(1)}` : 'Formateur'}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">{session.instructor.bio}</p>
          </Card>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          title={`Session : ${session.title}`}
          amount={session.price}
          currency={session.currency}
          onClose={() => setShowCheckout(false)}
          startCheckout={(gateway) => api.post(`/sessions/${session.id}/register/`, { ...info, gateway })}
          onCompleted={reload}
        />
      )}
    </div>
  );
};
