from django.contrib import admin, messages

from .models import Commission, Coupon, CouponUsage, CoursePurchase, Payment, Subscription
from .services import PaymentError, refund_payment


class CoursePurchaseInline(admin.StackedInline):
    model = CoursePurchase
    extra = 0
    can_delete = False
    readonly_fields = ['course', 'original_price', 'final_price', 'discount_amount', 'coupon_code', 'coupon_discount']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'amount', 'currency', 'type', 'gateway', 'status', 'is_sandbox',
                    'created_at']
    list_filter = ['status', 'gateway', 'type', 'is_sandbox']
    search_fields = ['reference', 'user__email', 'gateway_transaction_id']
    readonly_fields = ['reference', 'gateway_transaction_id', 'gateway_response', 'checkout_url', 'created_at',
                       'updated_at', 'completed_at']
    inlines = [CoursePurchaseInline]
    actions = ['refund']

    @admin.action(description='Rembourser les paiements sélectionnés')
    def refund(self, request, queryset):
        for payment in queryset:
            try:
                refund_payment(payment, 'Remboursement depuis l\'administration')
            except PaymentError as exc:
                self.message_user(request, f'{payment.reference} : {exc}', messages.ERROR)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'status', 'start_date', 'end_date', 'auto_renew', 'total_paid']
    list_filter = ['plan', 'status', 'auto_renew']
    search_fields = ['user__email']


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_type', 'discount_value', 'usage_count', 'usage_limit', 'valid_from',
                    'valid_until', 'status']
    list_filter = ['status', 'discount_type']
    search_fields = ['code']
    filter_horizontal = ['applicable_courses', 'applicable_categories']


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ['coupon', 'user', 'discount_amount', 'final_amount', 'used_at']


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ['instructor', 'total_amount', 'commission_amount', 'instructor_amount', 'is_paid', 'created_at']
    list_filter = ['is_paid']
    search_fields = ['instructor__email']
    actions = ['mark_paid']

    @admin.action(description='Marquer comme versées')
    def mark_paid(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_paid=True, paid_at=timezone.now())
