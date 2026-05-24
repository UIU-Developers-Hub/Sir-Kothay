from django.urls import path

from . import api_views

urlpatterns = [
    path('subscribe/<slug:user_slug>/', api_views.subscribe, name='notification_subscribe'),
    path('unsubscribe/<uuid:token>/', api_views.unsubscribe, name='notification_unsubscribe'),
    path('manage/', api_views.manage_subscriptions, name='notification_manage'),
    path('manage/request-link/', api_views.request_manage_link, name='notification_request_manage_link'),
    path('subscribers/', api_views.list_subscribers, name='notification_subscribers'),
    path('subscribers/<int:pk>/', api_views.remove_subscriber, name='notification_remove_subscriber'),
]
