from django.urls import path

from . import api_views

urlpatterns = [
    path('<slug:user_slug>/send/', api_views.send_dm, name='send_dm'),
    path('inbox/', api_views.inbox, name='dm_inbox'),
    path('unread/', api_views.unread_count, name='dm_unread_count'),
    path('<int:pk>/', api_views.dm_detail, name='dm_detail'),
    path('<int:pk>/reply/', api_views.reply_dm, name='dm_reply'),
    path('<int:pk>/delete/', api_views.delete_dm, name='dm_delete'),
]
