from django.urls import path

from . import views

app_name = 'sessions_live'

urlpatterns = [
    path('', views.SessionListView.as_view(), name='session-list'),
    path('create/', views.SessionCreateView.as_view(), name='session-create'),
    path('mine/', views.InstructorSessionListView.as_view(), name='session-mine'),
    path('registrations/', views.MyRegistrationsView.as_view(), name='my-registrations'),
    path('<uuid:pk>/', views.SessionDetailView.as_view(), name='session-detail'),
    path('<uuid:pk>/register/', views.register_to_session, name='session-register'),
    path('<uuid:pk>/cancel-registration/', views.cancel_registration, name='session-cancel-registration'),
    path('<uuid:pk>/join/', views.join_session, name='session-join'),
    path('<uuid:pk>/calendar.ics', views.session_calendar, name='session-calendar'),
    path('<uuid:pk>/attendees/', views.SessionAttendeesView.as_view(), name='session-attendees'),
    path('<uuid:pk>/complete/', views.complete_session, name='session-complete'),
]
