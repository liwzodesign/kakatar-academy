import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, FlaskConical } from 'lucide-react';
import { api } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { mapPayment } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { Payment } from '../../types';
import { Card, ErrorBox, Spinner, buttonPrimary, buttonSecondary } from '../UI';

function destination(p: Payment): { label: string; path: string } {
  if (p.courseSlug) return { label: 'Commencer le cours', path: `/learn/${p.courseSlug}` };
  if (p.type === 'SESSION_BOOKING') return { label: 'Voir mes sessions', path: '/sessions' };
  if (p.type === 'MARKETPLACE_ORDER') return { label: 'Voir mes achats', path: '/purchases' };
  return { label: 'Retour au tableau de bord', path: '/' };
}

/** Page de paiement simulé (mode sandbox / démonstration). */
export const PaymentSandbox: React.FC<{ paymentId: string }> = ({ paymentId }) => {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/payments/${paymentId}/`).then((p) => setPayment(mapPayment(p))).catch((e) => setError(e.message));
  }, [paymentId]);

  const act = async (action: 'confirm' | 'cancel') => {
    setBusy(true);
    try {
      await api.post(`/payments/${paymentId}/sandbox-confirm/`, { action });
      navigate(`/payment/return?payment=${paymentId}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!payment) return <Spinner />;

  return (
    <div className="max-w-md mx-auto">
      <Card className="text-center space-y-4">
        <FlaskConical className="w-12 h-12 text-sun-500 mx-auto" />
        <h1 className="text-xl font-extrabold text-gray-900">Paiement de démonstration</h1>
        <p className="text-gray-600 text-sm">
          Aucune passerelle réelle n'est configurée : ce paiement est simulé. En production, cette étape se déroule
          sur la page sécurisée de {payment.gatewayDisplay}.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-1">
          <p><span className="text-gray-500">Référence :</span> {payment.reference}</p>
          <p><span className="text-gray-500">Objet :</span> {payment.description}</p>
          <p><span className="text-gray-500">Montant :</span> <strong>{formatPrice(payment.amount, payment.currency)}</strong></p>
        </div>
        {payment.status === 'PENDING' ? (
          <div className="flex space-x-3">
            <button disabled={busy} onClick={() => act('cancel')} className={`${buttonSecondary} flex-1`}>Annuler</button>
            <button disabled={busy} onClick={() => act('confirm')} className={`${buttonPrimary} flex-1`}>Simuler le paiement</button>
          </div>
        ) : (
          <button onClick={() => navigate(`/payment/return?payment=${paymentId}`)} className={buttonPrimary}>Voir le résultat</button>
        )}
      </Card>
    </div>
  );
};

/** Page de retour après paiement : interroge le statut jusqu'à confirmation. */
export const PaymentReturn: React.FC<{ paymentId: string }> = ({ paymentId }) => {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (n: number) => {
      try {
        const p = mapPayment(await api.get(`/payments/${paymentId}/`));
        setPayment(p);
        setAttempts(n);
        if (p.status === 'PENDING' && n < 15) timer = setTimeout(() => poll(n + 1), 2000);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    poll(0);
    return () => clearTimeout(timer);
  }, [paymentId]);

  if (error) return <ErrorBox message={error} />;
  if (!payment) return <Spinner />;

  const dest = destination(payment);
  return (
    <div className="max-w-md mx-auto">
      <Card className="text-center space-y-4">
        {payment.status === 'COMPLETED' && (
          <>
            <CheckCircle className="w-16 h-16 text-secondary-600 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Paiement confirmé</h1>
            <p className="text-gray-600">Merci ! Un reçu vous a été envoyé par email (réf. {payment.reference}).</p>
            <button onClick={() => navigate(dest.path)} className={`${buttonPrimary} w-full py-3`}>{dest.label}</button>
          </>
        )}
        {payment.status === 'PENDING' && (
          <>
            <Clock className="w-16 h-16 text-sun-500 mx-auto animate-pulse" />
            <h1 className="text-2xl font-bold text-gray-900">Paiement en cours de confirmation</h1>
            <p className="text-gray-600">
              {attempts >= 15
                ? "La confirmation prend plus de temps que prévu. Vous recevrez un email dès qu'elle arrive."
                : 'Merci de patienter quelques secondes…'}
            </p>
          </>
        )}
        {['FAILED', 'CANCELLED'].includes(payment.status) && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Paiement non abouti</h1>
            <p className="text-gray-600">Aucun montant n'a été débité. Vous pouvez réessayer.</p>
            <button onClick={() => window.history.go(-2)} className={buttonSecondary}>Revenir</button>
          </>
        )}
        {payment.status === 'REFUNDED' && <p className="text-gray-600">Ce paiement a été remboursé.</p>}
      </Card>
    </div>
  );
};
