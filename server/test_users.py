import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authApp.models import CustomUser
from dashboard.models import UserDetails

missing = 0
for u in CustomUser.objects.all():
    try:
        UserDetails.objects.get(user=u)
    except UserDetails.DoesNotExist:
        missing += 1
        print(f"User {u.username} (id={u.id}, role={u.role}) has NO UserDetails!")
        UserDetails.objects.create(user=u)
        print(f"-> Created missing UserDetails for {u.username}")

print(f"Total missing: {missing}")
