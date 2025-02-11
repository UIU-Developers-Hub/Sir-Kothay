from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
import re


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    USERNAME_REGEX = r'^[a-zA-Z0-9@./+/-/_ ]*$'

    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'  # Use email as the username
    REQUIRED_FIELDS = ['username']  # Keep username required for creating user in admin

    objects = CustomUserManager()
    
    @property
    def readable_name(self):
        return " ".join(self.username.split('_')).title()
