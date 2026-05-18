import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from authApp.models import CustomUser

student = CustomUser.objects.filter(role='STUDENT').first()
client = APIClient()
client.force_authenticate(user=student)

response = client.get('/api/dashboard/student-interests/', format='json')
print("Type:", type(response.data))
print("Data:", response.data)
