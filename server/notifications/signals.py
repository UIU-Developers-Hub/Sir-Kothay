"""Signal to notify email subscribers when a broadcaster becomes available."""
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from dashboard.models import UserDetails
from .services import notify_subscribers


@receiver(pre_save, sender=UserDetails)
def cache_previous_availability(sender, instance, **kwargs):
    """Cache the previous is_available value before save."""
    if instance.pk:
        try:
            old = UserDetails.objects.get(pk=instance.pk)
            instance._was_available = old.is_available
        except UserDetails.DoesNotExist:
            instance._was_available = False
    else:
        instance._was_available = False


@receiver(post_save, sender=UserDetails)
def on_availability_changed(sender, instance, **kwargs):
    """When a broadcaster toggles availability, notify subscribers."""
    was_available = getattr(instance, '_was_available', False)
    # Only notify if there's an actual change in status/availability or if forced.
    # To keep it performant and exact, we notify whenever is_available has changed, or if status has changed.
    from broadcast.models import BroadcastMessage
    from .services import notify_broadcaster_status_change

    active = BroadcastMessage.objects.filter(user=instance.user, active=True).first()
    message = active.message if active else 'No status set'

    # Send updates to both anonymous subscribers and registered students
    notify_broadcaster_status_change(
        broadcaster=instance.user,
        message_text=message,
        new_is_available=instance.is_available,
        was_available=was_available
    )
