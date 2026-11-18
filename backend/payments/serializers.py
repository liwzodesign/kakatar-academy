from rest_framework import serializers

from .models import Commission, Coupon, CoursePurchase, Payment, Subscription


class CoursePurchaseSerializer(serializers.ModelSerializer):
    course = serializers.SerializerMethodField()

    class Meta:
        model = CoursePurchase
        fields = ['course', 'original_price', 'final_price', 'discount_amount', 'coupon_code', 'coupon_discount']

    def get_course(self, obj):
        return {'id': str(obj.course.id), 'title': obj.course.title, 'slug': obj.course.slug}


class PaymentSerializer(serializers.ModelSerializer):
    course_purchase = CoursePurchaseSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    gateway_display = serializers.CharField(source='get_gateway_display', read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'reference', 'user', 'amount', 'currency', 'type', 'status', 'status_display', 'gateway',
            'gateway_display', 'description', 'checkout_url', 'is_sandbox', 'course_purchase', 'created_at',
            'completed_at', 'error_message', 'metadata',
        ]
        read_only_fields = fields

    def get_user(self, obj):
        return {'id': str(obj.user.id), 'name': obj.user.get_full_name(), 'email': obj.user.email}


class CheckoutSerializer(serializers.Serializer):
    """Démarrage d'un paiement : un cours OU un abonnement."""
    GATEWAYS = ['STRIPE', 'PAYDUNYA', 'WAVE', 'MOBILE_MONEY']

    gateway = serializers.ChoiceField(choices=GATEWAYS)
    course_slug = serializers.SlugField(required=False)
    plan = serializers.ChoiceField(choices=['BASIC', 'PREMIUM', 'ENTERPRISE'], required=False)
    months = serializers.IntegerField(required=False, default=1)
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if bool(attrs.get('course_slug')) == bool(attrs.get('plan')):
            raise serializers.ValidationError('Indiquez soit « course_slug », soit « plan ».')
        return attrs


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_display = serializers.CharField(source='get_plan_display', read_only=True)
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = ['id', 'plan', 'plan_display', 'status', 'start_date', 'end_date', 'auto_renew', 'monthly_price',
                  'total_paid', 'is_active', 'days_remaining', 'created_at']
        read_only_fields = fields

    def get_is_active(self, obj):
        return obj.is_active()

    def get_days_remaining(self, obj):
        return obj.days_remaining()


class CouponSerializer(serializers.ModelSerializer):
    is_valid = serializers.SerializerMethodField()
    discount_display = serializers.CharField(source='get_discount_display', read_only=True)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value', 'discount_display', 'minimum_amount',
            'maximum_discount', 'usage_limit', 'usage_count', 'per_user_limit', 'valid_from', 'valid_until',
            'status', 'applicable_courses', 'applicable_categories', 'is_valid', 'created_at',
        ]
        read_only_fields = ['id', 'usage_count', 'created_at']

    def get_is_valid(self, obj):
        return obj.is_valid()

    def validate(self, attrs):
        valid_from = attrs.get('valid_from', getattr(self.instance, 'valid_from', None))
        valid_until = attrs.get('valid_until', getattr(self.instance, 'valid_until', None))
        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError({'valid_until': 'Doit être postérieure à la date de début.'})
        if attrs.get('discount_type') == Coupon.DiscountType.PERCENTAGE and attrs.get('discount_value', 0) > 100:
            raise serializers.ValidationError({'discount_value': 'Un pourcentage ne peut dépasser 100.'})
        attrs['code'] = attrs.get('code', getattr(self.instance, 'code', '')).upper()
        return attrs


class CouponValidationSerializer(serializers.Serializer):
    code = serializers.CharField()
    course_slug = serializers.SlugField(required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


class CommissionSerializer(serializers.ModelSerializer):
    course = serializers.SerializerMethodField()
    student = serializers.CharField(source='payment.user.get_full_name', read_only=True)

    class Meta:
        model = Commission
        fields = ['id', 'course', 'student', 'total_amount', 'commission_rate', 'commission_amount',
                  'instructor_amount', 'is_paid', 'paid_at', 'created_at']
        read_only_fields = fields

    def get_course(self, obj):
        purchase = getattr(obj.payment, 'course_purchase', None)
        return {'title': purchase.course.title, 'slug': purchase.course.slug} if purchase else None


class RefundSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class InstructorCouponSerializer(CouponSerializer):
    """Code promo d'un formateur : obligatoirement limité à ses propres cours."""

    class Meta(CouponSerializer.Meta):
        read_only_fields = CouponSerializer.Meta.read_only_fields + ['applicable_categories']

    def validate_applicable_courses(self, courses):
        user = self.context['request'].user
        if not courses:
            raise serializers.ValidationError('Choisissez au moins un de vos cours.')
        if any(c.instructor_id != user.id for c in courses):
            raise serializers.ValidationError('Vous ne pouvez cibler que vos propres cours.')
        return courses

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Sans cours ciblé, un code s'appliquerait à toute la plateforme : interdit pour un formateur
        courses = attrs.get('applicable_courses', None if self.instance is None else self.instance.applicable_courses.all())
        if not courses:
            raise serializers.ValidationError({'applicable_courses': 'Choisissez au moins un de vos cours.'})
        if attrs.get('discount_type') == Coupon.DiscountType.PERCENTAGE and attrs.get('discount_value', 0) > 90:
            raise serializers.ValidationError({'discount_value': 'Remise limitée à 90 %.'})
        return attrs
