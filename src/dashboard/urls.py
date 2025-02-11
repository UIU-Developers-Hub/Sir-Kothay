from django.urls import path
from . import views

urlpatterns = [
    path('', views.home_view, name='home'),
    path('handle-user-info/', views.user_detail_view, name='user_details'),
]