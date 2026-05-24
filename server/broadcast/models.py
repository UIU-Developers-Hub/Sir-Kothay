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

        # Revert expired users to their default status ONLY IF no new message took over
        for uid in expired_user_ids:
            if not cls.objects.filter(user_id=uid, active=True).exists():
                cls._revert_to_default(uid)

    @classmethod
    def _revert_to_default(cls, user_id):
        """When a timed message expires, revert availability to the user's default.
        The default_status text is served directly from UserDetails by the API —
        we do NOT create a new BroadcastMessage for it."""
        try:
            from dashboard.models import UserDetails
            from authApp.models import CustomUser
            u = CustomUser.objects.get(pk=user_id)
            details = u.details
            # Revert the availability status to the default fallback availability
            # We save unconditionally so the post_save signal fires and sends the fallback email
            details._force_notify = True
            details.is_available = details.default_availability
            details.save(update_fields=['is_available'])
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
        self.scheduled_for = None
        self._set_active_window()
        self.save(update_fields=['active', 'active_until', 'scheduled_for'])

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        became_active = False
        if self.active:
            if is_new:
                became_active = True
            else:
                try:
                    old_active = BroadcastMessage.objects.get(pk=self.pk).active
                    if not old_active:
                        became_active = True
                except BroadcastMessage.DoesNotExist:
                    pass

        _was_deactivated = False
        if self.active:
            if is_new:
                BroadcastMessage.objects.filter(user=self.user, active=True).update(active=False)
            else:
                BroadcastMessage.objects.filter(user=self.user, active=True).exclude(pk=self.pk).update(active=False)
            self._set_active_window()
        else:
            if not is_new:
                try:
                    old_active = BroadcastMessage.objects.get(pk=self.pk).active
                    if old_active:
                        _was_deactivated = True
                except BroadcastMessage.DoesNotExist:
                    pass
            if self.active_until is not None:
                self.active_until = None
                
        # SAVE FIRST! This ensures the message is in the database before signals fire.
        super().save(*args, **kwargs)

        if self.active:
            # Also apply availability preference if this message is going live
            try:
                from dashboard.models import UserDetails
                details, _ = UserDetails.objects.get_or_create(user=self.user)
                
                needs_save = False
                if self.set_availability in ['true', 'false']:
                    details.is_available = (self.set_availability == 'true')
                    needs_save = True
                    
                if needs_save or became_active:
                    if became_active:
                        details._force_notify = True
                    details.save()
            except Exception:
                pass
            
            if became_active:
                try:
                    from dashboard.models import FacultyActivity
                    FacultyActivity.objects.create(
                        faculty=self.user,
                        title="New Status",
                        details=self.message,
                        is_available=details.is_available
                    )
                except Exception:
                    pass

        # After ANY deactivation (manual stop, expiry, etc.):
        # if no active messages remain, revert to fallback defaults
        if _was_deactivated:
            has_active = BroadcastMessage.objects.filter(
                user=self.user, active=True
            ).exists()
            if not has_active:
                BroadcastMessage._revert_to_default(self.user_id)

    def __str__(self):
        return f'{self.user.username}: {self.message[:20]}'