from django.urls import path

from . import views

app_name = 'marketplace'

urlpatterns = [
    path('products/', views.ProductListView.as_view(), name='product-list'),
    path('products/create/', views.ProductCreateView.as_view(), name='product-create'),
    path('products/mine/', views.MyProductsView.as_view(), name='product-mine'),
    path('products/<slug:slug>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('products/<slug:slug>/purchase/', views.purchase_product, name='product-purchase'),
    path('products/<slug:slug>/reviews/', views.ProductReviewView.as_view(), name='product-reviews'),
    path('orders/', views.MyOrdersView.as_view(), name='my-orders'),
    path('orders/sales/', views.SellerOrdersView.as_view(), name='seller-orders'),
    path('orders/<uuid:pk>/download/', views.download_order, name='order-download'),
    path('orders/<uuid:pk>/deliver/', views.deliver_order, name='order-deliver'),
    path('orders/<uuid:pk>/complete/', views.complete_order, name='order-complete'),
]
