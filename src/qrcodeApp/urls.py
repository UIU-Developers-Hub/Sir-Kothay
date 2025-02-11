from django.urls import path
from . import views

urlpatterns = [
    path('generate-qr-code-with-logo/', views.generate_qr_code_with_logo, name='generate_qr'),
]