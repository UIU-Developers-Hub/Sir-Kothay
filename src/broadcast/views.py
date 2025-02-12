from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib import messages
from django.shortcuts import get_object_or_404
from dashboard.models import UserDetails
from django.contrib.auth.decorators import login_required

def show_broadcast_messages(request, user_slug):
    userd = get_object_or_404(UserDetails, _slug=user_slug)
    user = userd.user
    active_message = user.messages.filter(active=True).first()
    
    context = {
        'user': user,
        'username': user.username.replace('_', ' '),
        'userd': userd,
        'active_messages': active_message
    }
    
    return render(request, 'broadcast/message.html', context=context)

# Create your views here.
@login_required(login_url='login')
def add_broadcast_message(request):
    if request.method == 'POST':
        message = request.POST.get('message')
        if message:
            request.user.messages.create(message=message)
            messages.success(request, 'Message added successfully.')
        else:
            messages.error(request, 'Message cannot be empty.')
    
    return redirect(reverse('home'))

@login_required(login_url='login')
def delete_broadcast_message(request, message_id):
    message = request.user.messages.filter(id=message_id).first()
    if message:
        message.delete()
        messages.success(request, 'Message deleted successfully.')
    else:
        messages.error(request, 'Message not found.')
    
    return redirect(reverse('home'))

@login_required(login_url='login')
def update_broadcast_message(request, message_id):
    message = request.user.messages.filter(id=message_id).first()
    if message:
        message.message = request.POST.get('message')
        message.save()
        messages.success(request, 'Message updated successfully.')
    else:
        messages.error(request, 'Message not found.')
    
    return redirect(reverse('home'))

@login_required(login_url='login')
def toggle_broadcast_message(request, message_id):
    message = request.user.messages.filter(id=message_id).first()
    if message:
        message.active = not message.active
        message.save()
        messages.success(request, 'Message toggled successfully.')
    else:
        messages.error(request, 'Message not found.')
    
    return redirect(reverse('home'))