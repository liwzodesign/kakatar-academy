import mimetypes
import os

from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from payments.models import Payment
from payments.services import PaymentError, start_item_checkout
from users.emails import send_templated_email
from users.permissions import IsFormateurUser
from notifications.services import notify

from .models import Order, Product, ProductReview
from .serializers import (
    DeliverSerializer, OrderSerializer, ProductReviewSerializer, ProductSerializer, PurchaseSerializer,
)
from .services import finalize_order


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['type', 'category', 'seller']
    search_fields = ['title', 'description', 'seller__first_name', 'seller__last_name']
    ordering_fields = ['price', 'sales_count', 'rating_average', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Product.objects.filter(status=Product.Status.PUBLISHED).select_related('seller', 'category')


class ProductCreateView(generics.CreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = 'slug'

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsFormateurUser()]

    def get_queryset(self):
        user = self.request.user
        qs = Product.objects.select_related('seller', 'category')
        if user.is_authenticated:
            return qs.filter(Q(status=Product.Status.PUBLISHED) | Q(seller=user))
        return qs.filter(status=Product.Status.PUBLISHED)

    def get_object(self):
        product = super().get_object()
        if self.request.method not in permissions.SAFE_METHODS and product.seller_id != self.request.user.id:
            raise PermissionDenied("Ce produit ne vous appartient pas.")
        return product

    def perform_destroy(self, instance):
        instance.status = Product.Status.ARCHIVED
        instance.save(update_fields=['status'])


class MyProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_queryset(self):
        return Product.objects.filter(seller=self.request.user).exclude(status=Product.Status.ARCHIVED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def purchase_product(request, slug):
    product = get_object_or_404(Product, slug=slug, status=Product.Status.PUBLISHED)
    if product.seller_id == request.user.id:
        return Response({'error': 'Vous êtes le vendeur de ce produit.'}, status=status.HTTP_400_BAD_REQUEST)
    if product.is_digital and Order.objects.filter(buyer=request.user, product=product,
                                                   status__in=['PAID', 'DELIVERED', 'COMPLETED']).exists():
        return Response({'error': 'Vous possédez déjà ce produit.'}, status=status.HTTP_400_BAD_REQUEST)
    serializer = PurchaseSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    order = Order.objects.create(buyer=request.user, product=product, amount=product.price,
                                 currency=product.currency, requirements=data['requirements'])
    if product.price == 0:
        finalize_order(order)
        return Response({'order': OrderSerializer(order, context={'request': request}).data, 'checkout_url': None},
                        status=status.HTTP_201_CREATED)
    if not data.get('gateway'):
        order.delete()
        return Response({'error': 'Choisissez un moyen de paiement (gateway).'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        payment, url = start_item_checkout(
            request.user, Payment.Type.MARKETPLACE_ORDER, product.price, product.currency,
            f'Marketplace : {product.title}', product.seller, {'order_id': str(order.id)}, data['gateway'])
    except PaymentError as exc:
        order.status = Order.Status.CANCELLED
        order.save(update_fields=['status'])
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    order.payment = payment
    order.save(update_fields=['payment'])
    return Response({'order': OrderSerializer(order, context={'request': request}).data,
                     'payment_id': str(payment.id), 'checkout_url': url}, status=status.HTTP_201_CREATED)


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).exclude(status=Order.Status.PENDING) \
            .select_related('product__seller')


class SellerOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    pagination_class = None

    def get_queryset(self):
        return Order.objects.filter(product__seller=self.request.user) \
            .exclude(status__in=[Order.Status.PENDING, Order.Status.CANCELLED]).select_related('product', 'buyer')


def _file_response(file_field, filename_hint):
    name = os.path.basename(file_field.name) or filename_hint
    content_type = mimetypes.guess_type(name)[0] or 'application/octet-stream'
    return FileResponse(file_field.open('rb'), as_attachment=True, filename=name, content_type=content_type)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_order(request, pk):
    """Téléchargement sécurisé : uniquement l'acheteur d'une commande payée."""
    order = get_object_or_404(Order.objects.select_related('product'), pk=pk, buyer=request.user)
    if not order.is_paid():
        return Response({'error': 'Commande non payée'}, status=status.HTTP_403_FORBIDDEN)
    file_field = order.delivery_file or order.product.file
    if not file_field:
        return Response({'error': 'Aucun fichier à télécharger'}, status=status.HTTP_404_NOT_FOUND)
    Order.objects.filter(pk=order.pk).update(download_count=order.download_count + 1)
    return _file_response(file_field, order.product.slug)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def deliver_order(request, pk):
    """Le vendeur livre une prestation (message + fichier facultatif)."""
    order = get_object_or_404(Order.objects.select_related('product', 'buyer'), pk=pk,
                              product__seller=request.user)
    if order.status != Order.Status.PAID:
        return Response({'error': 'Cette commande ne peut pas être livrée.'}, status=status.HTTP_400_BAD_REQUEST)
    serializer = DeliverSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order.delivery_message = serializer.validated_data['delivery_message']
    if serializer.validated_data.get('delivery_file'):
        order.delivery_file = serializer.validated_data['delivery_file']
    order.status = Order.Status.DELIVERED
    order.delivered_at = timezone.now()
    order.save()
    notify(order.buyer, 'ORDER', f'Commande livrée : {order.product.title}', order.delivery_message[:200],
           '/purchases')
    send_templated_email(f'Votre commande a été livrée : {order.product.title}', 'emails/order_delivered.html',
                         {'user': order.buyer, 'order': order}, [order.buyer.email])
    return Response(OrderSerializer(order, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def complete_order(request, pk):
    """L'acheteur valide la livraison d'une prestation."""
    order = get_object_or_404(Order, pk=pk, buyer=request.user, status=Order.Status.DELIVERED)
    order.status = Order.Status.COMPLETED
    order.save(update_fields=['status'])
    return Response(OrderSerializer(order, context={'request': request}).data)


class ProductReviewView(generics.ListCreateAPIView):
    serializer_class = ProductReviewSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        return ProductReview.objects.filter(product__slug=self.kwargs['slug']).select_related('user')

    def perform_create(self, serializer):
        product = get_object_or_404(Product, slug=self.kwargs['slug'])
        if not Order.objects.filter(buyer=self.request.user, product=product,
                                    status__in=['DELIVERED', 'COMPLETED']).exists():
            raise PermissionDenied('Seuls les acheteurs peuvent laisser un avis.')
        if ProductReview.objects.filter(product=product, user=self.request.user).exists():
            raise PermissionDenied('Vous avez déjà laissé un avis.')
        serializer.save(product=product, user=self.request.user)
