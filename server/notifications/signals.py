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
    """When a broadcaster toggles from unavailable to available, notify subscribers."""
    was_available = getattr(instance, '_was_available', False)
    if not was_available and instance.is_available:
        # Just became available — notify subscribers
        from broadcast.models import BroadcastMessage
        active = BroadcastMessage.objects.filter(user=instance.user, active=True).first()
        message = active.message if active else 'is now available'
        notify_subscribers(instance.user, message)
