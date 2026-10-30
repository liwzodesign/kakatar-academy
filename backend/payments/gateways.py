"""Clients HTTP pour Wave Checkout et PayDunya.

On ne fait jamais confiance au navigateur ni au contenu brut d'un webhook :
l'état final d'un paiement est toujours relu auprès de la passerelle.
"""
import hashlib
import hmac
import logging
import time
from dataclasses import dataclass
from decimal import Decimal

import requests
from django.conf import settings

logger = logging.getLogger(__name__)
TIMEOUT = 20


class GatewayError(Exception):
    pass


@dataclass
class CheckoutResult:
    reference: str      # id de session Wave (cos-…) ou token de facture PayDunya
    checkout_url: str
    raw: dict


def _amount_str(amount: Decimal, currency: str) -> str:
    # Wave : pas de décimales pour le XOF
    if currency.upper() == 'XOF':
        return str(int(Decimal(amount).quantize(Decimal('1'))))
    return f"{Decimal(amount):.2f}"


# --- Wave --------------------------------------------------------------------

class WaveGateway:
    name = 'WAVE'

    def __init__(self):
        self.api_key = settings.WAVE_API_KEY
        self.base = settings.WAVE_API_BASE.rstrip('/')

    @property
    def configured(self):
        return bool(self.api_key)

    def _headers(self):
        return {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}

    def create_checkout(self, *, amount, currency, client_reference, success_url, error_url) -> CheckoutResult:
        payload = {
            'amount': _amount_str(amount, currency),
            'currency': currency.upper(),
            'client_reference': client_reference,
            'success_url': success_url,
            'error_url': error_url,
        }
        try:
            r = requests.post(f'{self.base}/checkout/sessions', json=payload,
                              headers=self._headers(), timeout=TIMEOUT)
        except requests.RequestException as exc:
            raise GatewayError(f'Wave injoignable : {exc}') from exc
        if r.status_code >= 400:
            logger.warning('Wave checkout error %s: %s', r.status_code, r.text[:500])
            raise GatewayError(f'Wave a refusé la création du paiement ({r.status_code}).')
        data = r.json()
        return CheckoutResult(reference=data['id'], checkout_url=data['wave_launch_url'], raw=data)

    def fetch_status(self, reference: str) -> tuple[str, dict]:
        """Retourne ('completed' | 'failed' | 'pending', données brutes)."""
        try:
            r = requests.get(f'{self.base}/checkout/sessions/{reference}',
                             headers=self._headers(), timeout=TIMEOUT)
        except requests.RequestException as exc:
            raise GatewayError(f'Wave injoignable : {exc}') from exc
        if r.status_code >= 400:
            raise GatewayError(f'Session Wave introuvable ({r.status_code}).')
        data = r.json()
        payment_status = data.get('payment_status')
        checkout_status = data.get('checkout_status')
        if payment_status == 'succeeded':
            return 'completed', data
        if payment_status == 'cancelled' or checkout_status == 'expired':
            return 'failed', data
        return 'pending', data

    @staticmethod
    def verify_webhook(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
        """Vérifie l'en-tête Wave-Signature.

        Format attendu « t=<timestamp>,v1=<hmac>[,v1=…] » où le HMAC-SHA256 porte sur
        timestamp + corps brut. Une signature hexadécimale nue sur le corps est aussi acceptée.
        """
        if not secret or not header:
            return False
        header = header.strip()
        parts = dict()
        signatures = []
        for item in header.split(','):
            if '=' in item:
                k, v = item.split('=', 1)
                k, v = k.strip(), v.strip()
                if k == 'v1':
                    signatures.append(v)
                else:
                    parts[k] = v
        if 't' in parts and signatures:
            try:
                ts = int(parts['t'])
            except ValueError:
                return False
            if abs(time.time() - ts) > tolerance:
                return False
            expected = hmac.new(secret.encode(), parts['t'].encode() + raw_body, hashlib.sha256).hexdigest()
            return any(hmac.compare_digest(expected, sig) for sig in signatures)
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, header)


# --- PayDunya ----------------------------------------------------------------

class PayDunyaGateway:
    name = 'PAYDUNYA'

    def __init__(self):
        self.master_key = settings.PAYDUNYA_MASTER_KEY
        self.private_key = settings.PAYDUNYA_PRIVATE_KEY
        self.token = settings.PAYDUNYA_TOKEN
        prefix = 'api' if settings.PAYDUNYA_MODE == 'live' else 'sandbox-api'
        self.base = f'https://app.paydunya.com/{prefix}/v1'

    @property
    def configured(self):
        return all([self.master_key, self.private_key, self.token])

    def _headers(self):
        return {
            'Content-Type': 'application/json',
            'PAYDUNYA-MASTER-KEY': self.master_key,
            'PAYDUNYA-PRIVATE-KEY': self.private_key,
            'PAYDUNYA-TOKEN': self.token,
        }

    def create_checkout(self, *, amount, currency, client_reference, description,
                        return_url, cancel_url, callback_url) -> CheckoutResult:
        payload = {
            'invoice': {'total_amount': int(Decimal(amount)), 'description': description[:250]},
            'store': {'name': settings.PAYDUNYA_STORE_NAME},
            'actions': {'return_url': return_url, 'cancel_url': cancel_url, 'callback_url': callback_url},
            'custom_data': {'payment_id': client_reference},
        }
        try:
            r = requests.post(f'{self.base}/checkout-invoice/create', json=payload,
                              headers=self._headers(), timeout=TIMEOUT)
            data = r.json()
        except (requests.RequestException, ValueError) as exc:
            raise GatewayError(f'PayDunya injoignable : {exc}') from exc
        if data.get('response_code') != '00':
            logger.warning('PayDunya create error: %s', data)
            raise GatewayError(data.get('response_text') or 'PayDunya a refusé la création du paiement.')
        return CheckoutResult(reference=data['token'], checkout_url=data['response_text'], raw=data)

    def fetch_status(self, reference: str) -> tuple[str, dict]:
        try:
            r = requests.get(f'{self.base}/checkout-invoice/confirm/{reference}',
                             headers=self._headers(), timeout=TIMEOUT)
            data = r.json()
        except (requests.RequestException, ValueError) as exc:
            raise GatewayError(f'PayDunya injoignable : {exc}') from exc
        st = str(data.get('status', '')).lower()
        if st == 'completed':
            return 'completed', data
        if st in ('cancelled', 'canceled', 'failed'):
            return 'failed', data
        return 'pending', data

    def verify_ipn_hash(self, received_hash: str) -> bool:
        if not self.master_key or not received_hash:
            return False
        expected = hashlib.sha512(self.master_key.encode()).hexdigest()
        return hmac.compare_digest(expected, received_hash)


GATEWAYS = {'WAVE': WaveGateway, 'PAYDUNYA': PayDunyaGateway}


def get_gateway(name: str):
    cls = GATEWAYS.get(name)
    if not cls:
        raise GatewayError('Moyen de paiement non pris en charge.')
    return cls()
