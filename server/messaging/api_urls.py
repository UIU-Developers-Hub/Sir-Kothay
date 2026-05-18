from django.urls import path

from . import api_views
from . import chat_views

urlpatterns = [
    # Legacy anonymous DMs
    path('<slug:user_slug>/send/', api_views.send_dm, name='send_dm'),
    path('inbox/', api_views.inbox, name='dm_inbox'),
    path('unread/', api_views.unread_count, name='dm_unread_count'),
    path('<int:pk>/', api_views.dm_detail, name='dm_detail'),
    path('<int:pk>/reply/', api_views.reply_dm, name='dm_reply'),
    path('<int:pk>/delete/', api_views.delete_dm, name='dm_delete'),
    path('<int:pk>/close-dm/', api_views.close_dm, name='dm_close'),

    # Threaded chat system
    path('chat/initiate/', chat_views.initiate_chat, name='chat_initiate'),
    path('chat/threads/', chat_views.list_threads, name='chat_threads'),
    path('chat/<int:pk>/', chat_views.thread_detail, name='chat_detail'),
    path('chat/<int:pk>/accept/', chat_views.accept_thread, name='chat_accept'),
    path('chat/<int:pk>/reply/', chat_views.reply_thread, name='chat_reply'),
    path('chat/<int:pk>/close/', chat_views.close_thread, name='chat_close'),
    path('chat/check/<int:faculty_id>/', chat_views.check_thread, name='chat_check'),
    path('chat/<int:pk>/delete/', chat_views.delete_thread, name='chat_delete'),
    path('chat/delete-all/', chat_views.close_and_delete_all, name='chat_delete_all'),
]
