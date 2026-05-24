from django.conf import settings
from django.db import models


class DirectMessage(models.Model):
    """A private message sent by a visitor (anonymous or logged-in) to a broadcaster."""
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
    is_closed = models.BooleanField(default=False)
    allows_replies = models.BooleanField(default=True)
    reply_body = models.TextField(blank=True, default='')
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'DM from {self.sender_name} to {self.broadcaster.username}'


class ChatThread(models.Model):
    """A threaded conversation between a registered student and a faculty member."""
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_threads',
    )
    faculty = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='faculty_threads',
    )
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    accepted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='closed_threads',
    )
    last_activity_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_by_student = models.BooleanField(default=False)
    deleted_by_faculty = models.BooleanField(default=False)

    class Meta:
        ordering = ['-last_activity_at']

    def __str__(self):
        return f'Chat: {self.student.username} ↔ {self.faculty.username} [{self.status}]'


class ChatMessage(models.Model):
    """An individual message within a ChatThread."""
    thread = models.ForeignKey(
        ChatThread,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_chat_messages',
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.body[:50]}'
