from django.contrib import admin

from .models import Order, Product, ProductReview


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['title', 'seller', 'type', 'price', 'status', 'sales_count', 'rating_average']
    list_filter = ['type', 'status']
    search_fields = ['title', 'seller__email']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['product', 'buyer', 'amount', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['product__title', 'buyer__email']


admin.site.register(ProductReview)
