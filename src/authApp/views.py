from django.contrib import messages
from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required

from .forms import EmailAuthenticationForm, RegisterForm, UserPasswordUpdateForm


def register_view(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            # Create a new user
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])  # Set the password hash
            user.save()

            # Optionally log the user in after successful registration
            login(request, user)

            # Redirect to the desired page (e.g., home or dashboard)
            messages.success(request, "Registration successful! You are now logged in.")
            return redirect('home')  # Update this with your home page or dashboard URL
        else:
            messages.error(request, "Please correct the errors below.")
    else:
        form = RegisterForm()

    return render(request, 'index.html', {'form': form})

def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')
    
    if request.method == 'POST':
        form = EmailAuthenticationForm(request, data=request.POST)
        if form.is_valid():
            email = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=email, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, "Login successful! You are now logged in.")
                return redirect('home')  # redirect to your desired page
    else:
        form = EmailAuthenticationForm()

    return render(request, 'auth/login.html', {'form': form})

@login_required(login_url='login')
def logout_view(request):
    logout(request)
    messages.success(request, "Logout successful! You are now logged out.")
    return redirect('index')  # redirect to your desired page

@login_required(login_url='login')
def update_password(request):
    if request.method == 'POST':
        form = UserPasswordUpdateForm(user=request.user, data=request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Your password has been updated successfully!")
        else:
            messages.error(request, "There was an error updating your password. Please try again.")
    
    return redirect(reverse('home'))