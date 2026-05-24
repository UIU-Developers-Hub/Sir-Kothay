"""Legacy template-based views — kept only because core/urls.py wires them.

All real auth is handled by the DRF API endpoints in api_views.py.
These stubs return JSON pointers so anyone hitting the old URLs knows
where to go.
"""
from django.contrib.auth import logout
from django.http import JsonResponse
from django.shortcuts import redirect


def register_view(request):
    return JsonResponse({
        'message': 'Please use the API endpoint for registration',
        'endpoint': '/api/auth/users/register/',
        'method': 'POST',
        'required_fields': ['username', 'email', 'password'],
    })


def login_view(request):
    return JsonResponse({
        'message': 'Please use the API endpoint for login',
        'endpoint': '/api/auth/users/login/',
        'method': 'POST',
        'required_fields': ['email', 'password'],
    })


def logout_view(request):
    logout(request)
    return redirect('login')