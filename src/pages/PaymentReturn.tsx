import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { Payment } from '../types';

/** Page de retour Wave / PayDunya : on interroge le backend, qui vérifie auprès de la passerelle. */
export default function PaymentReturn() {
  const [params] = useSearchParams();
  const id = params.get('payment');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const tries = useRef(0);

  useEffect(() => {
    if (!id) { setError('Paiement introuvable.'); return; }
    let timer: number;
    const poll = async () => {
      try {
        const p = await api<Payment>(`/payments/${id}/`);
        setPayment(p);
        if ((p.status === 'PROCESSING' || p.status === 'PENDING') && tries.current++ < 20) {
          timer = window.setTimeout(poll, 3000);
        }
      } catch (e) { setError((e as Error).message); }
    };
    poll();
    return () => window.clearTimeout(timer);
  }, [id]);

  const done = payment?.status === 'COMPLETED';
  const failed = payment && ['FAILED', 'CANCELLED'].includes(payment.status);
  const waiting = !error && !done && !failed;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {waiting && (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-600" />
          <h1 className="mt-4 text-xl font-bold">Confirmation du paiement…</h1>
          <p className="mt-2 text-gray-600">
            {tries.current > 19
              ? "Le paiement n'est pas encore confirmé. Si vous avez payé, l'accès s'ouvrira automatiquement dans quelques minutes."
              : 'Merci de patienter quelques secondes.'}
          </p>
        </>
      )}
      {done && (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold">Paiement confirmé</h1>
          <p className="mt-2 text-gray-600">Votre accès à « {payment?.course?.title} » est ouvert.</p>
          {payment?.course && (
            <Link to={`/apprendre/${payment.course.slug}`}
              className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
              Commencer la formation
            </Link>
          )}
        </>
      )}
      {(failed || error) && (
        <>
          <XCircle className="mx-auto h-12 w-12 text-red-600" />
          <h1 className="mt-4 text-xl font-bold">Paiement non abouti</h1>
          <p className="mt-2 text-gray-600">{error || "Le paiement a été annulé ou a échoué. Aucun montant n'a été validé."}</p>
          {payment?.course && (
            <Link to={`/formations/${payment.course.slug}`}
              className="mt-6 inline-block rounded-lg border border-gray-300 px-5 py-3 font-semibold">
              Réessayer
            </Link>
          )}
        </>
      )}
    </div>
  );
}
