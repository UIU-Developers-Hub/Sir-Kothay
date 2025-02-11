from django.db import models
from django.conf import settings


# Create your models here.
class UserDetails(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="details")
    profile_image = models.ImageField(upload_to='profile_images/')
    phone_number = models.CharField(max_length=15)
    bio = models.TextField()
    designation = models.CharField(max_length=150)
    organization = models.CharField(max_length=150)
    _slug = models.SlugField(max_length=100, unique=True, blank=True, null=True)
    
    @property
    def slug(self):
        if not self._slug:
            self.save()
        return self._slug
    
    @property
    def get_image_url(self):
        if self.profile_image and hasattr(self.profile_image, 'url'):
            return self.profile_image.url   
        else:
            return None
        
    def save(self, *args, **kwargs):
        if not self._slug:
            self._slug = f"{self.user.username}-{self.pk}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.designation} at {self.organization}"