from django.conf import settings
from django.db import models


class DirectMessage(models.Model):
    """A private message sent by a visitor to a broadcaster."""
    broadcaster = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_dms',
    )
    sender_name = models.CharField(max_length=150)
    sender_email = models.EmailField()
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    reply_body = models.TextField(blank=True, default='')
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'DM from {self.sender_name} to {self.broadcaster.username}'
