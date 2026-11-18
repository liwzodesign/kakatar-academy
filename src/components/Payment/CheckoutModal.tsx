import React, { useEffect, useState } from 'react';
import { CreditCard, Smartphone, Tag } from 'lucide-react';
import { api } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { navigate } from '../../lib/router';
import { Gateway } from '../../types';
import { ErrorBox, Modal, buttonPrimary, inputClass } from '../UI';

interface CheckoutModalProps {
  title: string;
  amount: number;
  currency?: string;
  /** Code coupon accepté ? (cours et abonnements uniquement) */
  allowCoupon?: boolean;
  courseSlug?: string;
  onClose: () => void;
  /** Démarre le paiement et renvoie l'URL de la page de paiement (ou null si validé directement). */
  startCheckout: (gateway: string, couponCode: string) => Promise<{ checkout_url: string | null }>;
  onCompleted?: () => void;
}

/** Redirige vers la page de paiement (externe) ou vers la page sandbox interne. */
export function goToCheckout(url: string) {
  const target = new URL(url, window.location.origin);
  if (target.origin === window.location.origin) navigate(target.pathname + target.search);
  else window.location.href = url;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  title, amount, currency = 'XOF', allowCoupon = false, courseSlug, onClose, startCheckout, onCompleted,
}) => {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gateway, setGateway] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState<{ final: number; label: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/payments/config/').then((cfg) => {
      setGateways(cfg.gateways);
      if (cfg.gateways[0]) setGateway(cfg.gateways[0].code);
    }).catch((err) => setError(err.message));
  }, []);

  const checkCoupon = async () => {
    setError('');
    setCouponInfo(null);
    try {
      const res = await api.post('/payments/coupons/validate/', { code: coupon, course_slug: courseSlug, amount });
      setCouponInfo({ final: Number(res.final_amount), label: res.discount_display });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await startCheckout(gateway, couponInfo ? coupon : '');
      if (res.checkout_url) goToCheckout(res.checkout_url);
      else {
        onCompleted?.();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const sandbox = gateways.find((g) => g.code === gateway)?.sandbox;

  return (
    <Modal title="Paiement" onClose={onClose}>
      <div className="space-y-5">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {couponInfo ? (
              <>
                <span className="line-through text-gray-400 text-lg mr-2">{formatPrice(amount, currency)}</span>
                {formatPrice(couponInfo.final, currency)}
              </>
            ) : (
              formatPrice(amount, currency)
            )}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Moyen de paiement</p>
          <div className="space-y-2">
            {gateways.map((g) => (
              <label
                key={g.code}
                className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer ${gateway === g.code ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input type="radio" name="gateway" checked={gateway === g.code} onChange={() => setGateway(g.code)} />
                {g.code === 'STRIPE' ? <CreditCard className="w-5 h-5 text-gray-500" /> : <Smartphone className="w-5 h-5 text-gray-500" />}
                <span className="font-medium text-gray-900">{g.label}</span>
              </label>
            ))}
            {gateways.length === 0 && !error && <p className="text-sm text-gray-500">Chargement des moyens de paiement…</p>}
          </div>
          {sandbox && (
            <p className="text-xs text-sun-700 bg-sun-50 rounded p-2 mt-2">
              Mode démonstration : aucune somme ne sera prélevée (passerelle non configurée).
            </p>
          )}
        </div>

        {allowCoupon && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Code promo</p>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className={`${inputClass} pl-9`} placeholder="BIENVENUE20" />
              </div>
              <button onClick={checkCoupon} disabled={!coupon} className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Appliquer
              </button>
            </div>
            {couponInfo && <p className="text-sm text-secondary-700 mt-1">Code appliqué ({couponInfo.label})</p>}
          </div>
        )}

        {error && <ErrorBox message={error} />}

        <button onClick={pay} disabled={busy || !gateway} className={`${buttonPrimary} w-full py-3`}>
          {busy ? 'Redirection…' : 'Payer maintenant'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          Paiement sécurisé : vous serez redirigé vers la page de la passerelle. Nous ne stockons aucune donnée bancaire.
        </p>
      </div>
    </Modal>
  );
};
