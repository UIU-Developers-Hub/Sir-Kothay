"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include


from django.conf import settings
from django.conf.urls.static import static

from django.views.generic import TemplateView
from django.shortcuts import redirect

def redirect_authenticated_user(request):
    if request.user.is_authenticated:
        return redirect('home')
    return TemplateView.as_view(template_name='index.html')(request)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', redirect_authenticated_user, name='index'),
    path('auth/', include('authApp.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('broadcast/', include('broadcast.urls')),
    path('qrcode/', include('qrcodeApp.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
