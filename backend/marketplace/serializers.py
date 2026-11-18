from rest_framework import serializers

from courses.models import Category

from .models import Order, Product, ProductReview


class ProductSerializer(serializers.ModelSerializer):
    seller = serializers.SerializerMethodField()
    preview = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    is_digital = serializers.BooleanField(read_only=True)
    is_owner = serializers.SerializerMethodField()
    has_purchased = serializers.SerializerMethodField()
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)
    file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'title', 'description', 'type', 'category', 'tags', 'price', 'currency', 'preview',
            'preview_image', 'preview_url', 'delivery_days', 'status', 'sales_count', 'rating_average',
            'rating_count', 'seller', 'has_file', 'is_digital', 'is_owner', 'has_purchased', 'file', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'sales_count', 'rating_average', 'rating_count', 'created_at']
        extra_kwargs = {'preview_image': {'write_only': True, 'required': False}}

    def get_seller(self, obj):
        return {'id': str(obj.seller.id), 'name': obj.seller.get_full_name(), 'avatar': obj.seller.get_avatar_url(),
                'is_verified': obj.seller.is_verified}

    def get_preview(self, obj):
        if obj.preview_image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.preview_image.url) if request else obj.preview_image.url
        return obj.preview_url

    def get_has_file(self, obj):
        return bool(obj.file)

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.seller_id == request.user.id)

    def get_has_purchased(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.orders.filter(
            buyer=request.user, status__in=['PAID', 'DELIVERED', 'COMPLETED']).exists())


class OrderSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    buyer = serializers.SerializerMethodField()
    has_delivery_file = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'product', 'buyer', 'status', 'amount', 'currency', 'requirements', 'delivery_message',
                  'has_delivery_file', 'delivered_at', 'download_count', 'created_at']
        read_only_fields = fields

    def get_buyer(self, obj):
        return {'id': str(obj.buyer.id), 'name': obj.buyer.get_full_name(), 'email': obj.buyer.email}

    def get_has_delivery_file(self, obj):
        return bool(obj.delivery_file)


class PurchaseSerializer(serializers.Serializer):
    gateway = serializers.ChoiceField(choices=['STRIPE', 'PAYDUNYA', 'WAVE', 'MOBILE_MONEY'], required=False)
    requirements = serializers.CharField(required=False, allow_blank=True, default='')


class DeliverSerializer(serializers.Serializer):
    delivery_message = serializers.CharField()
    delivery_file = serializers.FileField(required=False)


class ProductReviewSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = ProductReview
        fields = ['id', 'user', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
