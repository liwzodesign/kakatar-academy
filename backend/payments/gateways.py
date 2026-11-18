"""
Passerelles de paiement.

Chaque passerelle expose :
  - create_checkout(payment) -> CheckoutResult (URL de la page de paiement hébergée)
  - verify(payment) -> 'COMPLETED' | 'FAILED' | 'PENDING'  (interrogation côté serveur)

Aucune donnée de carte ne transite par notre serveur : l'utilisateur paie sur la page
hébergée de la passerelle (conformité PCI-DSS déléguée), puis la confirmation arrive par
webhook et/ou par vérification serveur au retour de l'utilisateur.

Si une passerelle n'est pas configurée et que PAYMENTS_ALLOW_SANDBOX est actif, le
paiement est simulé via SandboxGateway (développement et démonstrations).
"""
import hashlib
import hmac
import logging
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Devises sans décimales pour Stripe (montant transmis tel quel)
ZERO_DECIMAL_CURRENCIES = {'XOF', 'XAF', 'GNF', 'JPY', 'KRW', 'RWF', 'UGX', 'VND', 'BIF', 'CLP', 'DJF', 'KMF',
                           'MGA', 'PYG', 'VUV', 'XPF'}


class GatewayError(Exception):
    pass


@dataclass
class CheckoutResult:
    checkout_url: str
    transaction_id: str = ''
    raw: dict = None


def _return_urls(payment):
    base = settings.FRONTEND_URL.rstrip('/')
    return (f"{base}/payment/return?payment={payment.id}&status=success",
            f"{base}/payment/return?payment={payment.id}&status=cancel")


class BaseGateway:
    code = ''

    def is_configured(self):
        raise NotImplementedError

    def create_checkout(self, payment):
        raise NotImplementedError

    def verify(self, payment):
        raise NotImplementedError


class SandboxGateway(BaseGateway):
    """Paiement simulé : redirige vers une page de confirmation du frontend."""
    code = 'SANDBOX'

    def is_configured(self):
        return settings.PAYMENTS_ALLOW_SANDBOX

    def create_checkout(self, payment):
        base = settings.FRONTEND_URL.rstrip('/')
        return CheckoutResult(checkout_url=f"{base}/payment/sandbox?payment={payment.id}",
                              transaction_id=f"sandbox_{payment.reference}", raw={'sandbox': True})

    def verify(self, payment):
        return payment.status if payment.status in ('COMPLETED', 'FAILED') else 'PENDING'


class StripeGateway(BaseGateway):
    code = 'STRIPE'

    def is_configured(self):
        return bool(settings.STRIPE_SECRET_KEY)

    def _client(self):
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        return stripe

    @staticmethod
    def to_minor_units(amount, currency):
        if currency.upper() in ZERO_DECIMAL_CURRENCIES:
            return int(round(amount))
        return int(round(amount * 100))

    def create_checkout(self, payment):
        stripe = self._client()
        success_url, cancel_url = _return_urls(payment)
        try:
            session = stripe.checkout.Session.create(
                mode='payment',
                customer_email=payment.user.email,
                client_reference_id=str(payment.id),
                line_items=[{
                    'quantity': 1,
                    'price_data': {
                        'currency': payment.currency.lower(),
                        'unit_amount': self.to_minor_units(payment.amount, payment.currency),
                        'product_data': {'name': payment.description[:250] or 'Kakatar Academy'},
                    },
                }],
                metadata={'payment_id': str(payment.id), 'reference': payment.reference},
                success_url=success_url,
                cancel_url=cancel_url,
            )
        except Exception as exc:
            logger.exception('Stripe : création de session impossible')
            raise GatewayError(str(exc)) from exc
        return CheckoutResult(checkout_url=session.url, transaction_id=session.id, raw={'session_id': session.id})

    def verify(self, payment):
        if not payment.gateway_transaction_id:
            return 'PENDING'
        session = self._client().checkout.Session.retrieve(payment.gateway_transaction_id)
        if session.payment_status == 'paid':
            return 'COMPLETED'
        if session.status == 'expired':
            return 'FAILED'
        return 'PENDING'

    def parse_webhook(self, payload, signature):
        """Valide la signature et renvoie l'événement Stripe."""
        stripe = self._client()
        return stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)

    def refund(self, payment):
        stripe = self._client()
        session = stripe.checkout.Session.retrieve(payment.gateway_transaction_id)
        return stripe.Refund.create(payment_intent=session.payment_intent)


class PayDunyaGateway(BaseGateway):
    """PayDunya (Orange Money, Wave, Free Money, cartes…) — API « checkout-invoice »."""
    code = 'PAYDUNYA'

    def is_configured(self):
        return all([settings.PAYDUNYA_MASTER_KEY, settings.PAYDUNYA_PRIVATE_KEY, settings.PAYDUNYA_TOKEN])

    @property
    def base_url(self):
        if settings.PAYDUNYA_MODE == 'live':
            return 'https://app.paydunya.com/api/v1'
        return 'https://app.paydunya.com/sandbox-api/v1'

    def _headers(self):
        return {
            'Content-Type': 'application/json',
            'PAYDUNYA-MASTER-KEY': settings.PAYDUNYA_MASTER_KEY,
            'PAYDUNYA-PRIVATE-KEY': settings.PAYDUNYA_PRIVATE_KEY,
            'PAYDUNYA-TOKEN': settings.PAYDUNYA_TOKEN,
        }

    def create_checkout(self, payment):
        success_url, cancel_url = _return_urls(payment)
        body = {
            'invoice': {'total_amount': int(payment.amount), 'description': payment.description[:250]},
            'store': {'name': 'Kakatar Academy', 'website_url': settings.FRONTEND_URL},
            'actions': {
                'cancel_url': cancel_url,
                'return_url': success_url,
                'callback_url': f"{settings.BACKEND_URL.rstrip('/')}/api/v1/payments/webhooks/paydunya/",
            },
            'custom_data': {'payment_id': str(payment.id), 'reference': payment.reference},
        }
        try:
            resp = requests.post(f'{self.base_url}/checkout-invoice/create', json=body, headers=self._headers(),
                                 timeout=20)
            data = resp.json()
        except Exception as exc:
            raise GatewayError(f'PayDunya injoignable : {exc}') from exc
        if data.get('response_code') != '00':
            raise GatewayError(data.get('response_text') or 'Erreur PayDunya')
        return CheckoutResult(checkout_url=data['response_text'], transaction_id=data.get('token', ''), raw=data)

    def verify(self, payment):
        if not payment.gateway_transaction_id:
            return 'PENDING'
        resp = requests.get(f'{self.base_url}/checkout-invoice/confirm/{payment.gateway_transaction_id}',
                            headers=self._headers(), timeout=20)
        data = resp.json()
        status = (data.get('status') or '').lower()
        if status == 'completed':
            return 'COMPLETED'
        if status in ('cancelled', 'failed'):
            return 'FAILED'
        return 'PENDING'

    @staticmethod
    def valid_ipn_hash(received_hash):
        expected = hashlib.sha512(settings.PAYDUNYA_MASTER_KEY.encode()).hexdigest()
        return bool(received_hash) and hmac.compare_digest(expected, received_hash)


class WaveGateway(BaseGateway):
    """Wave Checkout API (Sénégal, Côte d'Ivoire…)."""
    code = 'WAVE'
    base_url = 'https://api.wave.com/v1'

    def is_configured(self):
        return bool(settings.WAVE_API_KEY)

    def _headers(self):
        return {'Authorization': f'Bearer {settings.WAVE_API_KEY}', 'Content-Type': 'application/json'}

    def create_checkout(self, payment):
        success_url, cancel_url = _return_urls(payment)
        body = {
            'amount': str(int(payment.amount)),
            'currency': payment.currency,
            'client_reference': str(payment.id),
            'success_url': success_url,
            'error_url': cancel_url,
        }
        try:
            resp = requests.post(f'{self.base_url}/checkout/sessions', json=body, headers=self._headers(), timeout=20)
            data = resp.json()
        except Exception as exc:
            raise GatewayError(f'Wave injoignable : {exc}') from exc
        if resp.status_code >= 400 or 'wave_launch_url' not in data:
            raise GatewayError(data.get('message') or 'Erreur Wave')
        return CheckoutResult(checkout_url=data['wave_launch_url'], transaction_id=data['id'], raw=data)

    def verify(self, payment):
        if not payment.gateway_transaction_id:
            return 'PENDING'
        resp = requests.get(f'{self.base_url}/checkout/sessions/{payment.gateway_transaction_id}',
                            headers=self._headers(), timeout=20)
        data = resp.json()
        if data.get('payment_status') == 'succeeded':
            return 'COMPLETED'
        if data.get('checkout_status') == 'expired':
            return 'FAILED'
        return 'PENDING'

    @staticmethod
    def valid_signature(body: bytes, header: str):
        """En-tête Wave-Signature : « t=<timestamp>,v1=<hmac_sha256(timestamp + body)> »."""
        if not settings.WAVE_WEBHOOK_SECRET or not header:
            return False
        pairs = [p.split('=', 1) for p in header.split(',') if '=' in p]
        timestamp = next((v for k, v in pairs if k.strip() == 't'), None)
        signatures = [v for k, v in pairs if k.strip() == 'v1']
        if not timestamp:
            return False
        expected = hmac.new(settings.WAVE_WEBHOOK_SECRET.encode(), timestamp.encode() + body, hashlib.sha256).hexdigest()
        return any(hmac.compare_digest(expected, s) for s in signatures)


GATEWAYS = {
    'STRIPE': StripeGateway(),
    'PAYDUNYA': PayDunyaGateway(),
    'MOBILE_MONEY': PayDunyaGateway(),  # Orange Money / Free Money via PayDunya
    'WAVE': WaveGateway(),
}
SANDBOX = SandboxGateway()


def get_gateway(code):
    """Renvoie la passerelle demandée, ou le sandbox si elle n'est pas configurée (dev)."""
    gateway = GATEWAYS.get(code)
    if gateway is None:
        raise GatewayError('Passerelle inconnue')
    if gateway.is_configured():
        return gateway
    if SANDBOX.is_configured():
        return SANDBOX
    raise GatewayError(f'La passerelle {code} n\'est pas configurée')


def available_gateways():
    return [
        {'code': code, 'label': label, 'sandbox': not GATEWAYS[code].is_configured()}
        for code, label in [('WAVE', 'Wave'), ('MOBILE_MONEY', 'Orange Money / Free Money'),
                            ('PAYDUNYA', 'PayDunya'), ('STRIPE', 'Carte bancaire')]
        if GATEWAYS[code].is_configured() or SANDBOX.is_configured()
    ]
