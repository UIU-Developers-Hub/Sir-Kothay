import uuid

from django.conf import settings
from django.db import models


class StatusSubscription(models.Model):
    """Email subscription — visitor gets notified when broadcaster status changes to Available."""
    email = models.EmailField()
    broadcaster = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='status_subscribers',
    )
    is_active = models.BooleanField(default=True)
    unsubscribe_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('email', 'broadcaster')]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.email} → {self.broadcaster.username}'
