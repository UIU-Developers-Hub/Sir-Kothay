import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient

from authApp.models import CustomUser

# Create a NEW student
new_student = CustomUser.objects.create_user(
    username=f'newstudent{random.randint(100,999)}',
    email=f'newstudent{random.randint(100,999)}@test.com',
    password='password',
    role='STUDENT',
    student_id=f'01111111{random.randint(100,999)}'
)

faculty = CustomUser.objects.filter(role='FACULTY').first()

client = APIClient()
client.force_authenticate(user=new_student)

response = client.post('/api/dashboard/student-interests/', {'faculty': faculty.id}, format='json')
print(f"Status Code: {response.status_code}")
print(f"Response Data: {response.data}")
