from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class BroadcastMessage(models.Model):
    SOURCE_MANUAL = 'manual'
    SOURCE_RECURRING = 'recurring'
    SOURCE_CALENDAR = 'calendar'
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_RECURRING, 'Recurring schedule'),
        (SOURCE_CALENDAR, 'Calendar event'),
    ]

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

    # Scheduling provenance. One generated row represents one concrete occurrence,
    # so stopping it can suppress only that occurrence without pausing its source.
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    source_id = models.PositiveBigIntegerField(blank=True, null=True)
    occurrence_key = models.CharField(max_length=80, blank=True, default='')
    started_at = models.DateTimeField(blank=True, null=True)
    manually_stopped = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'active'], name='broadcast_u_active_idx'),
            models.Index(fields=['source_type', 'source_id', 'occurrence_key'], name='broadcast_source_occ_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source_type', 'source_id', 'occurrence_key'],
                condition=Q(source_id__isnull=False),
                name='unique_schedule_occurrence',
            ),
        ]

    @classmethod
    def activate_due_messages(cls, user=None):
        """Materialize due work and reconcile the best live status per user."""
        now = timezone.now()
        affected_user_ids = set()

        due = cls.objects.filter(
            source_type=cls.SOURCE_MANUAL,
            manually_stopped=False,
            started_at__isnull=True,
            scheduled_for__isnull=False,
            scheduled_for__lte=now,
        )
        if user is not None:
            due = due.filter(user=user)

        for message in due:
            started_at = message.scheduled_for
            active_until = (
                started_at + timedelta(seconds=message.duration_seconds)
                if message.duration_seconds else None
            )
            cls.objects.filter(pk=message.pk).update(
                started_at=started_at,
                active_until=active_until,
            )
            affected_user_ids.add(message.user_id)

        expiring = cls.objects.filter(active=True, active_until__isnull=False, active_until__lte=now)
        if user is not None:
            expiring = expiring.filter(user=user)
        affected_user_ids.update(expiring.values_list('user_id', flat=True))

        try:
            from scheduler.services import process_calendar_events, process_recurring_schedules

            affected_user_ids.update(process_recurring_schedules(user=user, now=now))
            affected_user_ids.update(process_calendar_events(user=user, now=now))
        except ImportError:
            pass

        if user is not None:
            affected_user_ids.add(user.pk)
        else:
            affected_user_ids.update(
                cls.objects.filter(active=True).values_list('user_id', flat=True).distinct()
            )

        for user_id in affected_user_ids:
            cls.reconcile_user(user_id, now=now)

    @classmethod
    def _source_is_enabled(cls, message):
        if message.source_type == cls.SOURCE_MANUAL:
            return True
        try:
            if message.source_type == cls.SOURCE_RECURRING:
                from scheduler.models import RecurringSchedule
                return RecurringSchedule.objects.filter(pk=message.source_id, is_active=True).exists()
            if message.source_type == cls.SOURCE_CALENDAR:
                from scheduler.models import CalendarEvent
                return CalendarEvent.objects.filter(pk=message.source_id, is_active=True).exists()
        except (ImportError, TypeError, ValueError):
            return False
        return False

    @classmethod
    def reconcile_user(cls, user_id, now=None, fallback_if_empty=False):
        """Choose the newest still-valid, non-suppressed status for a user.

        Preempted messages keep their original validity window. When the newer
        status ends, this method promotes the most recent eligible predecessor.
        """
        now = now or timezone.now()
        messages = cls.objects.filter(user_id=user_id)
        had_active = messages.filter(active=True).exists()

        messages.filter(active=True, active_until__isnull=False, active_until__lte=now).update(active=False)

        candidates = messages.filter(
            manually_stopped=False,
            started_at__isnull=False,
            started_at__lte=now,
        ).filter(Q(active_until__isnull=True) | Q(active_until__gt=now)).order_by('-started_at', '-id')

        winner = next((candidate for candidate in candidates if cls._source_is_enabled(candidate)), None)
        current = messages.filter(active=True).first()

        if winner is not None:
            if current is None or current.pk != winner.pk:
                preempted = messages.filter(active=True).exclude(pk=winner.pk)
                preempted.filter(active_until__isnull=True).update(active=False, manually_stopped=True)
                preempted.filter(active_until__isnull=False).update(active=False)
                winner.activate_now(preserve_window=True, promote=False)
            return winner

        if current is not None:
            messages.filter(active=True).update(active=False)
        if had_active or fallback_if_empty:
            cls._revert_to_default(user_id)
        return None

    @classmethod
    def _revert_to_default(cls, user_id):
        """Restore the configured fallback availability when nothing is live."""
        try:
            from dashboard.models import UserDetails

            details = UserDetails.objects.get(user_id=user_id)
            details._force_notify = True
            details.is_available = details.default_availability
            details.save(update_fields=['is_available'])
        except Exception:
            pass

    def _set_active_window(self, started_at=None):
        start = started_at or timezone.now()
        self.active_until = (
            start + timedelta(seconds=self.duration_seconds)
            if self.duration_seconds else None
        )

    def activate_now(self, preserve_window=False, promote=True):
        """Make this message live.

        Generated occurrences preserve their fixed end time. Explicitly pressing
        Go Live promotes the occurrence, while automatic restoration retains its
        original ordering position.
        """
        now = timezone.now()
        if preserve_window and self.active_until and self.active_until <= now:
            return False

        self.active = True
        self.manually_stopped = False
        if promote or self.started_at is None:
            self.started_at = now
        if not preserve_window:
            self._set_active_window(started_at=now)
            if self.source_type == self.SOURCE_MANUAL:
                self.scheduled_for = None

        self._preserve_active_window = True
        self.save()
        return True

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old = None
        if not is_new:
            try:
                old = BroadcastMessage.objects.get(pk=self.pk)
            except BroadcastMessage.DoesNotExist:
                pass

        became_active = self.active and (is_new or old is None or not old.active)
        was_deactivated = bool(old and old.active and not self.active)

        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            update_fields = set(update_fields)

        if self.active:
            preempted = BroadcastMessage.objects.filter(user=self.user, active=True).exclude(pk=self.pk)
            # "Until I change" has no remaining fixed window once another
            # status takes over, so it must not later reappear from the stack.
            preempted.filter(active_until__isnull=True).update(active=False, manually_stopped=True)
            preempted.filter(active_until__isnull=False).update(active=False)
            self.manually_stopped = False
            if self.started_at is None:
                self.started_at = timezone.now()
            if became_active and not getattr(self, '_preserve_active_window', False):
                self._set_active_window()
            if update_fields is not None:
                update_fields.update({'active', 'active_until', 'started_at', 'manually_stopped'})
        elif was_deactivated:
            # A model-level active -> inactive transition is a user's Stop action.
            # Internal preemption/expiry uses QuerySet.update and does not set this.
            self.manually_stopped = True
            if update_fields is not None:
                update_fields.update({'active', 'manually_stopped'})

        if update_fields is not None:
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)

        if self.active:
            try:
                from dashboard.models import FacultyActivity, UserDetails

                details, _ = UserDetails.objects.get_or_create(user=self.user)
                if self.set_availability in ('true', 'false'):
                    details.is_available = self.set_availability == 'true'
                if became_active:
                    details._force_notify = True
                if became_active or self.set_availability in ('true', 'false'):
                    details.save()

                if became_active:
                    FacultyActivity.objects.create(
                        faculty=self.user,
                        title='New Status',
                        details=self.message,
                        is_available=details.is_available,
                    )
            except Exception:
                pass

        if was_deactivated:
            BroadcastMessage.reconcile_user(self.user_id, fallback_if_empty=True)

    def delete(self, *args, **kwargs):
        user_id = self.user_id
        was_active = self.active
        result = super().delete(*args, **kwargs)
        BroadcastMessage.reconcile_user(user_id, fallback_if_empty=was_active)
        return result

    def __str__(self):
        return f'{self.user.username}: {self.message[:20]}'
