from django.db import models
from django.conf import settings


# Create your models here.
class QRCode(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="qr_code")
    image = models.ImageField(upload_to='qr_codes/', null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    
    @property
    def get_qr_url(self):
        if self.image and hasattr(self.image, 'url'):
            return self.image.url
        else:
            return None

    def __str__(self):
        return f"QR Code for {self.user.username}"