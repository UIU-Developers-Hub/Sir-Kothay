from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from broadcast.models import BroadcastMessage
from .models import UserDetails
from qrcodeApp.models import QRCode

# Create your views here.
@login_required(login_url='login')
def home_view(request):
    user = user=request.user
    messages = BroadcastMessage.objects.all().filter(user=user)
    userd = UserDetails.objects.get(user=user)
    
    try:
        qrcode = QRCode.objects.get(user=user)
    except QRCode.DoesNotExist:
        qrcode = None
    
    return render(request, 'dashboard/home.html', {
        'messages': messages,
        'userd': userd,
        'qrcode': qrcode
    })

@login_required(login_url='login')
def user_detail_view(request):
    if request.method == 'POST':
        # Update user details
        # to do
        pass
    
    return redirect(reverse('home'))