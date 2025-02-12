from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from broadcast.models import BroadcastMessage
from .models import UserDetails
from qrcodeApp.models import QRCode
from django.contrib import messages


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
        'qrcode': qrcode,
        'username': user.username.replace('_', ' ')
    })

@login_required(login_url='login')
def user_detail_view(request):
    if request.method == 'POST':
        user = request.user
        details, created = UserDetails.objects.get_or_create(user=user)

        # Update user fields
        user.username = request.POST.get('username', user.username)
        user.email = request.POST.get('email', user.email)
        user.save()

        # Update UserDetails fields
        details.bio = request.POST.get('bio', details.bio)
        details.organization = request.POST.get('organization', details.organization)
        details.designation = request.POST.get('designation', details.designation)
        details.phone_number = request.POST.get('phone_number', details.phone_number)
        
        # Update profile image
        if 'profile_image' in request.FILES:
            details.profile_image = request.FILES['profile_image']

        details.save()

        messages.success(request, "Profile updated successfully!")
        return redirect('home')  # Redirect to home or profile page
    
    return redirect(reverse('home'))