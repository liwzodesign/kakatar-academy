from django.urls import path

from . import views

app_name = 'paths'

urlpatterns = [
    path('', views.path_list, name='list'),
    path('<slug:slug>/', views.path_detail, name='detail'),
    path('<slug:slug>/enroll/', views.path_enroll, name='enroll'),
]
