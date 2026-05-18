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
    is_available = models.BooleanField(
        default=False,
        help_text='Whether the broadcaster is currently available. Toggling to True notifies subscribers.',
    )
    _slug = models.SlugField(max_length=100, unique=True, blank=True, null=True)

    @property
    def slug(self):
        return self._slug or ''

    @property
    def get_image_url(self):
        if self.profile_image and hasattr(self.profile_image, 'url'):
            return self.profile_image.url
        return None

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        desired = build_public_slug(self.user.username, self.pk)
        if self._slug != desired:
            type(self).objects.filter(pk=self.pk).update(_slug=desired)
            self._slug = desired

    def __str__(self):
        return f"{self.designation} at {self.organization}"
