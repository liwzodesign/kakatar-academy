from django.db import transaction
from django.db.models import F

from users.emails import send_templated_email
from notifications.services import notify

from .models import Order, Product


def _notify_paid(order):
    send_templated_email(f'Commande confirmée : {order.product.title}', 'emails/order_confirmation.html',
                         {'user': order.buyer, 'order': order}, [order.buyer.email])
    if not order.product.is_digital:
        seller = order.product.seller
        send_templated_email(f'Nouvelle commande : {order.product.title}', 'emails/order_seller.html',
                             {'user': seller, 'order': order}, [seller.email])


def finalize_order(order):
    """Une ressource numérique est livrée immédiatement ; une prestation attend le vendeur."""
    order.status = Order.Status.COMPLETED if order.product.is_digital else Order.Status.PAID
    order.save(update_fields=['status'])
    notify(order.buyer, 'ORDER', f'Commande confirmée : {order.product.title}',
           'Téléchargement disponible' if order.product.is_digital else 'Le vendeur a été prévenu', '/purchases')
    notify(order.product.seller, 'ORDER', f'Nouvelle vente : {order.product.title}',
           f'Acheteur : {order.buyer.get_full_name()}', '/marketplace')
    Product.objects.filter(pk=order.product_id).update(sales_count=F('sales_count') + 1)
    transaction.on_commit(lambda: _notify_paid(order))
    return order


@transaction.atomic
def mark_order_paid(payment):
    """Appelé par payments.services.fulfill_payment."""
    order = Order.objects.select_related('product__seller', 'buyer') \
        .filter(id=(payment.metadata or {}).get('order_id')).first()
    if not order or order.is_paid():
        return order
    order.payment = payment
    order.save(update_fields=['payment'])
    return finalize_order(order)
