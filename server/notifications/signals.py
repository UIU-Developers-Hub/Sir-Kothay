"""Signal to notify email subscribers when a broadcaster becomes available."""
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from dashboard.models import UserDetails
from .services import notify_subscribers


@receiver(pre_save, sender=UserDetails)
def cache_previous_availability(sender, instance, **kwargs):
    """Cache the previous is_available and default_status values before save."""
    if instance.pk:
        try:
            old = UserDetails.objects.get(pk=instance.pk)
            instance._was_available = old.is_available
            instance._old_default_status = old.default_status
        except UserDetails.DoesNotExist:
            instance._was_available = False
            instance._old_default_status = ''
    else:
        instance._was_available = False
        instance._old_default_status = ''


@receiver(post_save, sender=UserDetails)
def on_availability_changed(sender, instance, **kwargs):
    """When a broadcaster toggles availability, notify subscribers."""
    was_available = getattr(instance, '_was_available', False)
    old_default_status = getattr(instance, '_old_default_status', instance.default_status)
    force_notify = getattr(instance, '_force_notify', False)

    from broadcast.models import BroadcastMessage
    from .services import notify_broadcaster_status_change

    active = BroadcastMessage.objects.filter(user=instance.user, active=True).first()
    
    # We only notify if availability changed, or if it was explicitly forced (e.g., new broadcast published).
    changed = False
    if force_notify:
        changed = True
    elif instance.is_available != was_available:
        changed = True

    if not changed:
        return
    
    if active:
        message = active.message
    else:
        message = instance.default_status if instance.default_status else 'No active status'

    # Send updates to both anonymous subscribers and registered students
    notify_broadcaster_status_change(
        broadcaster=instance.user,
        message_text=message,
        new_is_available=instance.is_available,
        was_available=was_available
    )
