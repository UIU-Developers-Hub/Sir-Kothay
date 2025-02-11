from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'  # Use email as the username
    REQUIRED_FIELDS = ['username']  # Keep username required for creating user in admin
