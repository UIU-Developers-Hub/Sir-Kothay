import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authApp.models import CustomUser
from dashboard.serializers import StudentInterestSerializer
from dashboard.models import StudentInterest

student = CustomUser.objects.filter(role='STUDENT').first()

class DummyRequest:
    def __init__(self, user):
        self.user = user
    def build_absolute_uri(self, location):
        return "http://testserver" + location

interests = StudentInterest.objects.filter(student=student)
serializer = StudentInterestSerializer(interests, many=True, context={'request': DummyRequest(student)})
print(serializer.data)
