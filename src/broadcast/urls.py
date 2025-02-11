from django.urls import path
from . import views

urlpatterns = [
    path('add/', views.add_broadcast_message, name='add_broadcast_message'),
    path('delete/<int:message_id>/', views.delete_broadcast_message, name='delete_broadcast_message'),
    path('update/<int:message_id>/', views.update_broadcast_message, name='update_broadcast_message'),
    path('toggle/<int:message_id>/', views.toggle_broadcast_message, name='toggle_broadcast_message'),
    path('<slug:user_slug>/', views.show_broadcast_messages, name='show_broadcast_messages'),
]