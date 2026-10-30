from django.contrib import admin

from .models import Commission, Coupon, CouponUsage, CoursePurchase, Payment


class CoursePurchaseInline(admin.StackedInline):
    model = CoursePurchase
    extra = 0
    readonly_fields = ['course', 'original_price', 'final_price', 'coupon_code', 'coupon_discount']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'user', 'amount', 'currency', 'gateway', 'status']
    list_filter = ['status', 'gateway', 'created_at']
    search_fields = ['user__email', 'gateway_transaction_id', 'id']
    readonly_fields = ['id', 'gateway_transaction_id', 'checkout_url', 'gateway_response',
                       'created_at', 'updated_at', 'completed_at']
    inlines = [CoursePurchaseInline]


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_type', 'discount_value', 'usage_count', 'usage_limit',
                    'valid_from', 'valid_until', 'status']
    list_filter = ['status', 'discount_type']
    search_fields = ['code']
    filter_horizontal = ['applicable_courses', 'applicable_categories']


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'instructor', 'total_amount', 'commission_amount', 'instructor_amount', 'is_paid']
    list_filter = ['is_paid']


admin.site.register(CouponUsage)
