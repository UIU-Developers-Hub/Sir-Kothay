from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


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
    """
    Display name (`username`) may contain any characters up to 150 chars.
    Public URLs use a separate slug on UserDetails (ASCII, path-safe).
    """
    ROLE_CHOICES = (
        ('', 'None'),
        ('FACULTY', 'Faculty'),
        ('STUDENT', 'Student'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='FACULTY', blank=True)
    student_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    is_banned = models.BooleanField(default=False, help_text='Banned users cannot login even if is_active is True.')
    is_email_verified = models.BooleanField(default=False, help_text='Whether the user has verified their email address.')
    
    email = models.EmailField(unique=True)

    username = models.CharField(
        _('username'),
        max_length=150,
        unique=True,
        help_text=_('Required. 150 characters or fewer. Any characters are allowed.'),
        error_messages={
            'unique': _('A user with that username already exists.'),
        },
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = CustomUserManager()

    @property
    def readable_name(self):
        return " ".join(self.username.split('_')).title()

class EmailVerificationToken(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='email_verification')
    token = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Verification for {self.user.email}"


class AccountDeletionToken(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='deletion_token')
    token = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Deletion token for {self.user.email}"
