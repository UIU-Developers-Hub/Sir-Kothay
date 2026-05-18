from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta


# Create your models here.
class BroadcastMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
    message = models.TextField()
    active = models.BooleanField(default=True)
    scheduled_for = models.DateTimeField(blank=True, null=True)
    duration_seconds = models.PositiveIntegerField(blank=True, null=True)
    active_until = models.DateTimeField(blank=True, null=True)
    set_availability = models.CharField(
        max_length=10, blank=True, default='',
        help_text='When activated: "true"=Available, "false"=Unavailable, ""=no change.',
    )

    @classmethod
    def activate_due_messages(cls, user=None):
        """
        Activate scheduled messages when their scheduled time has passed.
        The most recently scheduled due message becomes active per user.
        Also runs the scheduler services (recurring + calendar + expiry).
        """
        now = timezone.now()
        # First, expire active messages whose duration ended.
        expiring = cls.objects.filter(active=True, active_until__isnull=False, active_until__lte=now)
        if user is not None:
            expiring = expiring.filter(user=user)

        expired_user_ids = list(expiring.values_list('user_id', flat=True).distinct())
        expiring.update(active=False)

        # Revert expired users to their default status
        for uid in expired_user_ids:
            cls._revert_to_default(uid)

        due = cls.objects.filter(active=False, scheduled_for__isnull=False, scheduled_for__lte=now)
        if user is not None:
            due = due.filter(user=user)

        user_ids = due.values_list('user_id', flat=True).distinct()
        for user_id in user_ids:
            latest_due = (
                cls.objects
                .filter(user_id=user_id, active=False, scheduled_for__isnull=False, scheduled_for__lte=now)
                .order_by('-scheduled_for', '-id')
                .first()
            )
            if latest_due:
                cls.objects.filter(user_id=user_id, active=True).update(active=False)
                latest_due.activate_now()

        # Run scheduler services (recurring schedules + calendar events)
        try:
            from scheduler.services import process_recurring_schedules, process_calendar_events
            process_recurring_schedules(user=user)
            process_calendar_events(user=user)
        except ImportError:
            pass

    @classmethod
    def _revert_to_default(cls, user_id):
        """When a timed message expires, activate the user's default status if set."""
        try:
            from dashboard.models import UserDetails
            from authApp.models import CustomUser
            u = CustomUser.objects.get(pk=user_id)
            details = u.details
            # 1. Revert the availability status to the default fallback availability
            if details.is_available != details.default_availability:
                details.is_available = details.default_availability
                details.save(update_fields=['is_available'])

            # 2. Revert the broadcast message to the default fallback status
            default_text = (details.default_status or '').strip()
            if not default_text:
                return

            already_active = cls.objects.filter(user_id=user_id, active=True).exists()
            if already_active:
                return
            
            cls.objects.create(
                user=u,
                message=default_text,
                active=True,
                duration_seconds=None,
            )
        except Exception:
            pass

    def _set_active_window(self):
        if self.duration_seconds:
            self.active_until = timezone.now() + timedelta(seconds=self.duration_seconds)
        else:
            # "Until I change" behavior
            self.active_until = None

    def activate_now(self):
        self.active = True
        self._set_active_window()
        self.save(update_fields=['active', 'active_until'])

    def save(self, *args, **kwargs):
        if self.active:
            BroadcastMessage.objects.filter(user=self.user, active=True).update(active=False)
            self._set_active_window()
            # Also apply availability preference if this message is going live
            if self.set_availability in ['true', 'false']:
                try:
                    from dashboard.models import UserDetails
                    UserDetails.objects.filter(user=self.user).update(
                        is_available=(self.set_availability == 'true')
                    )
                except Exception:
                    pass
        elif self.active_until is not None:
            self.active_until = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.username}: {self.message[:20]}'