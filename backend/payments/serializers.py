from rest_framework import serializers
from django.utils import timezone
from .models import (
    Payment, CoursePurchase, Subscription, Coupon, 
    CouponUsage, Commission
)

class PaymentSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les paiements"""
    
    user = serializers.SerializerMethodField()
    amount_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'user', 'amount', 'amount_display', 'currency', 'type',
            'status', 'status_display', 'gateway', 'gateway_transaction_id',
            'description', 'metadata', 'created_at', 'updated_at',
            'completed_at', 'error_message', 'retry_count'
        ]
        read_only_fields = [
            'id', 'gateway_transaction_id', 'gateway_response', 'created_at',
            'updated_at', 'completed_at', 'error_message', 'retry_count'
        ]
    
    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'name': obj.user.get_full_name(),
            'email': obj.user.email
        }
    
    def get_amount_display(self, obj):
        return obj.get_amount_display()
    
    def get_status_display(self, obj):
        return obj.get_status_display()

class PaymentCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un paiement"""
    
    class Meta:
        model = Payment
        fields = [
            'amount', 'currency', 'type', 'gateway', 'description', 'metadata'
        ]
    
    def validate(self, attrs):
        # Vérifications supplémentaires si nécessaire
        if attrs['amount'] <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0.")
        
        return attrs

class CoursePurchaseSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les achats de cours"""
    
    payment = PaymentSerializer(read_only=True)
    course = serializers.SerializerMethodField()
    total_discount = serializers.SerializerMethodField()
    
    class Meta:
        model = CoursePurchase
        fields = [
            'id', 'payment', 'course', 'original_price', 'final_price',
            'discount_amount', 'discount_percentage', 'coupon_code',
            'coupon_discount', 'total_discount', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_course(self, obj):
        return {
            'id': obj.course.id,
            'title': obj.course.title,
            'slug': obj.course.slug,
            'thumbnail': obj.course.thumbnail.url if obj.course.thumbnail else None
        }
    
    def get_total_discount(self, obj):
        return obj.get_total_discount()

class CoursePurchaseCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un achat de cours"""
    
    course_id = serializers.UUIDField(write_only=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = CoursePurchase
        fields = ['course_id', 'coupon_code']
    
    def validate(self, attrs):
        course_id = attrs.get('course_id')
        coupon_code = attrs.get('coupon_code')
        
        # Vérifier que le cours existe
        try:
            from courses.models import Course
            course = Course.objects.get(id=course_id, status='PUBLISHED')
            attrs['course'] = course
        except Course.DoesNotExist:
            raise serializers.ValidationError("Cours non trouvé ou non disponible.")
        
        # Vérifier le coupon si fourni
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code, status='ACTIVE')
                if not coupon.is_valid():
                    raise serializers.ValidationError("Code promo expiré ou invalide.")
                attrs['coupon'] = coupon
            except Coupon.DoesNotExist:
                raise serializers.ValidationError("Code promo invalide.")
        
        return attrs

class SubscriptionSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les abonnements"""
    
    user = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'user', 'plan', 'status', 'start_date', 'end_date',
            'auto_renew', 'monthly_price', 'total_paid', 'is_active',
            'days_remaining', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'name': obj.user.get_full_name(),
            'email': obj.user.email
        }
    
    def get_is_active(self, obj):
        return obj.is_active()
    
    def get_days_remaining(self, obj):
        return obj.days_remaining()

class SubscriptionCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour créer un abonnement"""
    
    class Meta:
        model = Subscription
        fields = ['plan', 'start_date', 'end_date', 'auto_renew', 'monthly_price']
    
    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError("La date de fin doit être postérieure à la date de début.")
        
        return attrs

class CouponSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les coupons"""
    
    is_valid = serializers.SerializerMethodField()
    discount_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'minimum_amount', 'maximum_discount', 'usage_limit', 'usage_count',
            'per_user_limit', 'valid_from', 'valid_until', 'status',
            'is_valid', 'discount_display', 'created_at'
        ]
        read_only_fields = ['id', 'usage_count', 'created_at']
    
    def get_is_valid(self, obj):
        return obj.is_valid()
    
    def get_discount_display(self, obj):
        if obj.discount_type == 'PERCENTAGE':
            return f"{obj.discount_value}%"
        else:
            return f"{obj.discount_value} {obj.currency if hasattr(obj, 'currency') else 'XOF'}"

class CouponValidationSerializer(serializers.Serializer):
    """Sérialiseur pour valider un coupon"""
    
    code = serializers.CharField(max_length=50)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    def validate(self, attrs):
        code = attrs.get('code')
        amount = attrs.get('amount')
        
        try:
            coupon = Coupon.objects.get(code=code)
        except Coupon.DoesNotExist:
            raise serializers.ValidationError("Code promo invalide.")
        
        if not coupon.is_valid():
            raise serializers.ValidationError("Code promo expiré ou inactif.")
        
        if amount < coupon.minimum_amount:
            raise serializers.ValidationError(
                f"Montant minimum requis: {coupon.minimum_amount}"
            )
        
        # Calculer la remise
        discount = coupon.calculate_discount(amount)
        
        attrs['coupon'] = coupon
        attrs['discount'] = discount
        attrs['final_amount'] = amount - discount
        
        return attrs

class CouponUsageSerializer(serializers.ModelSerializer):
    """Sérialiseur pour l'utilisation des coupons"""
    
    coupon = CouponSerializer(read_only=True)
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = CouponUsage
        fields = [
            'id', 'coupon', 'user', 'original_amount', 'discount_amount',
            'final_amount', 'used_at'
        ]
        read_only_fields = ['id', 'used_at']
    
    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'name': obj.user.get_full_name()
        }

class CommissionSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les commissions"""
    
    instructor = serializers.SerializerMethodField()
    payment = PaymentSerializer(read_only=True)
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Commission
        fields = [
            'id', 'instructor', 'payment', 'total_amount', 'commission_rate',
            'commission_amount', 'instructor_amount', 'is_paid', 'paid_at',
            'created_at', 'updated_at', 'status_display'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_instructor(self, obj):
        return {
            'id': obj.instructor.id,
            'name': obj.instructor.get_full_name(),
            'email': obj.instructor.email
        }
    
    def get_status_display(self, obj):
        return obj.get_status_display()

class PaymentWebhookSerializer(serializers.Serializer):
    """Sérialiseur pour les webhooks de paiement"""
    
    # Champs communs
    event_type = serializers.CharField()
    transaction_id = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()
    status = serializers.CharField()
    
    # Champs spécifiques Stripe
    stripe_signature = serializers.CharField(required=False)
    
    # Champs spécifiques PayDunya
    paydunya_token = serializers.CharField(required=False)
    
    def validate(self, attrs):
        # Validation spécifique selon le gateway
        event_type = attrs.get('event_type')
        if not event_type:
            raise serializers.ValidationError("Type d'événement requis.")
        
        return attrs

class RefundRequestSerializer(serializers.Serializer):
    """Sérialiseur pour demander un remboursement"""
    
    payment_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=500)
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False
    )
    
    def validate(self, attrs):
        payment_id = attrs.get('payment_id')
        
        try:
            payment = Payment.objects.get(id=payment_id)
            if payment.status != 'COMPLETED':
                raise serializers.ValidationError(
                    "Seuls les paiements terminés peuvent être remboursés."
                )
            attrs['payment'] = payment
        except Payment.DoesNotExist:
            raise serializers.ValidationError("Paiement non trouvé.")
        
        # Si le montant n'est pas spécifié, rembourser le montant total
        if 'amount' not in attrs:
            attrs['amount'] = payment.amount
        
        return attrs

class PaymentMethodSerializer(serializers.Serializer):
    """Sérialiseur pour les méthodes de paiement"""
    
    type = serializers.ChoiceField(choices=[
        ('card', 'Carte bancaire'),
        ('bank_transfer', 'Virement bancaire'),
        ('mobile_money', 'Mobile Money'),
        ('wave', 'Wave'),
        ('paydunya', 'PayDunya')
    ])
    
    # Champs pour carte bancaire
    card_number = serializers.CharField(required=False, max_length=19)
    expiry_month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    expiry_year = serializers.IntegerField(required=False)
    cvv = serializers.CharField(required=False, max_length=4)
    
    # Champs pour mobile money
    phone_number = serializers.CharField(required=False, max_length=15)
    operator = serializers.ChoiceField(required=False, choices=[
        ('orange', 'Orange Money'),
        ('mtn', 'MTN Mobile Money'),
        ('moov', 'Moov Money')
    ])
    
    def validate(self, attrs):
        payment_type = attrs.get('type')
        
        if payment_type == 'card':
            required_fields = ['card_number', 'expiry_month', 'expiry_year', 'cvv']
            for field in required_fields:
                if not attrs.get(field):
                    raise serializers.ValidationError(
                        f"Le champ {field} est requis pour les paiements par carte."
                    )
        
        elif payment_type == 'mobile_money':
            if not attrs.get('phone_number'):
                raise serializers.ValidationError(
                    "Le numéro de téléphone est requis pour les paiements mobile money."
                )
            if not attrs.get('operator'):
                raise serializers.ValidationError(
                    "L'opérateur mobile money est requis."
                )
        
        return attrs

class PaymentIntentSerializer(serializers.Serializer):
    """Sérialiseur pour créer une intention de paiement"""
    
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField(max_length=3, default='XOF')
    payment_method = PaymentMethodSerializer()
    metadata = serializers.JSONField(required=False, default=dict)
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à 0.")
        return value 