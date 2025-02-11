from django.shortcuts import render
from django.contrib.auth.decorators import login_required

# Create your views here.
@login_required(login_url='login')
def home_view(request):
    return render(request, 'dashboard/home.html')

@login_required(login_url='login')
def user_detail_view(request):
    if request.method == 'POST':
        # Update user details
        # to do
        pass
    
    return render(request, 'dashboard/home.html')