from django.conf import settings
from django.db import models
from django.utils.text import slugify


def build_public_slug(username: str, pk: int) -> str:
    """
    URL/path-safe slug for broadcast & QR links. Not the same as display username.
    Matches Django's <slug> path converter: letters, digits, underscores, hyphens.
    """
    base = slugify(str(username), allow_unicode=False)
    if not base:
        base = 'user'
    if len(base) > 80:
        base = base[:80]
    candidate = f'{base}-{pk}'
    return candidate[:100]


class UserDetails(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="details")
    profile_image = models.ImageField(upload_to='profile_images/')
    phone_number = models.CharField(max_length=15)
    bio = models.TextField()
    designation = models.CharField(max_length=150)
    organization = models.CharField(max_length=150)
    default_status = models.TextField(
        blank=True, default='',
        help_text='Fallback broadcast message activated when a timed status expires.',
    )
    default_availability = models.BooleanField(
        default=False,
        help_text='Fallback availability activated when a timed status expires.',
    )
    is_available = models.BooleanField(
        default=False,
        help_text='Whether the broadcaster is currently available. Toggling to True notifies subscribers.',
    )
    _slug = models.SlugField(max_length=100, unique=True, blank=True, null=True)

    # Notification settings
    notify_new_chats = models.BooleanField(
        default=True,
        help_text='Email me when a new chat thread is initiated.',
    )
    notify_chat_replies = models.BooleanField(
        default=False,
        help_text='Email me on each reply in active chat threads.',
    )
    notify_chat_closed = models.BooleanField(
        default=True,
        help_text='Email me when a chat thread is closed.',
    )
    auto_close_seconds = models.PositiveIntegerField(
        default=172800, null=True, blank=True,
        help_text='Seconds of inactivity before auto-closing chat threads. Null = never. Faculty only.',
    )
    auto_delete_closed_chats = models.BooleanField(
        default=False,
        help_text='If True, chat threads will be deleted instead of just closed when auto-closed.',
    )

    @property
    def slug(self):
        return self._slug or ''

    @property
    def get_image_url(self):
        if self.profile_image and hasattr(self.profile_image, 'url'):
            return self.profile_image.url
        return None

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_is_available = None
        old_image = None
        if not is_new:
            try:
                old = UserDetails.objects.get(pk=self.pk)
                old_is_available = old.is_available
                # If profile image changed, remember the old one for deletion
                if old.profile_image and old.profile_image != self.profile_image:
                    old_image = old.profile_image
            except UserDetails.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        # Delete the old profile image from storage after successful save
        if old_image:
            try:
                old_image.delete(save=False)
            except Exception:
                pass
        
        if not is_new and old_is_available is not None and old_is_available != self.is_available:
            title = "Now Available" if self.is_available else "Now Unavailable"
            FacultyActivity.objects.create(
                faculty=self.user,
                title=title,
                details="",
                is_available=self.is_available
            )
            
        desired = build_public_slug(self.user.username, self.pk)
        if self._slug != desired:
            type(self).objects.filter(pk=self.pk).update(_slug=desired)
            self._slug = desired

    def __str__(self):
        return f"{self.designation} at {self.organization}"

class StudentInterest(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='interested_faculties', on_delete=models.CASCADE)
    faculty = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='interested_students', on_delete=models.CASCADE)
    NOTIFY_ALL = 'all'
    NOTIFY_AVAILABLE = 'available'
    NOTIFY_NONE = 'none'
    NOTIFY_CHOICES = [
        (NOTIFY_ALL, 'All updates'),
        (NOTIFY_AVAILABLE, 'When available only'),
        (NOTIFY_NONE, 'Off'),
    ]
    notify_preference = models.CharField(
        max_length=10, choices=NOTIFY_CHOICES, default=NOTIFY_NONE,
        help_text='Notification preference for this faculty status updates.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'faculty')

    def __str__(self):
        return f"{self.student.username} -> {self.faculty.username}"


class FacultyActivity(models.Model):
    faculty = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='activities', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    details = models.TextField(blank=True, null=True)
    is_available = models.BooleanField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.faculty.username} - {self.title} at {self.created_at}"
