from django.db import models
from django.conf import settings


# Create your models here.
class BroadcastMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
    message = models.TextField()
    active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self.active:
            BroadcastMessage.objects.filter(user=self.user, active=True).update(active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.username}: {self.message[:20]}'