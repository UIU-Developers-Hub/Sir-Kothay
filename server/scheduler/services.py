"""Shared business logic for recurring schedules and calendar events.

Called lazily on relevant API requests AND by the management command
``python manage.py process_schedules``.
"""
from datetime import timedelta

from django.db.models import F
from django.utils import timezone

from broadcast.models import BroadcastMessage
from dashboard.models import UserDetails

from .models import CalendarEvent, RecurringSchedule


def _activate_broadcast_for_user(user, message_text, duration_minutes=None):
    """Create-and-activate a broadcast message for *user* with the given text."""
    BroadcastMessage.objects.filter(user=user, active=True).update(active=False)
    msg = BroadcastMessage.objects.create(
        user=user,
        message=message_text,
        active=True,
        duration_minutes=duration_minutes,
    )
    return msg


def _revert_to_default_status(user):
    """If a user has a default_status, activate it when a timed message expires."""
    try:
        details = user.details
    except UserDetails.DoesNotExist:
        return
    default_text = (details.default_status or '').strip()
    if not default_text:
        return
    already = BroadcastMessage.objects.filter(user=user, active=True).first()
    if already:
        return
    BroadcastMessage.objects.create(
        user=user,
        message=default_text,
        active=True,
        duration_minutes=None,
    )


def process_expiring_messages(user=None):
    """Expire messages whose active_until has passed, then revert to default status."""
    now = timezone.now()
    qs = BroadcastMessage.objects.filter(active=True, active_until__isnull=False, active_until__lte=now)
    if user is not None:
        qs = qs.filter(user=user)

    expired_user_ids = list(qs.values_list('user_id', flat=True).distinct())
    qs.update(active=False)

    for uid in expired_user_ids:
        from authApp.models import CustomUser
        try:
            u = CustomUser.objects.get(pk=uid)
            _revert_to_default_status(u)
        except CustomUser.DoesNotExist:
            pass


def process_recurring_schedules(user=None):
    """Check if any recurring schedule should fire right now."""
    now = timezone.now()
    current_dow = now.weekday()
    current_time = now.time()
    window_start = (now - timedelta(minutes=6)).time()

    qs = RecurringSchedule.objects.filter(is_active=True, day_of_week=current_dow)
    if user is not None:
        qs = qs.filter(user=user)

    for sched in qs:
        if not (window_start <= sched.time_of_day <= current_time):
            continue
        if sched.last_triggered_at:
            if (now - sched.last_triggered_at) < timedelta(minutes=10):
                continue

        _activate_broadcast_for_user(
            sched.user, sched.message, sched.duration_minutes,
        )
        # Also set availability if configured
        if sched.set_availability:
            UserDetails.objects.filter(user=sched.user).update(
                is_available=(sched.set_availability == 'true')
            )
        sched.last_triggered_at = now
        sched.save(update_fields=['last_triggered_at'])


def process_calendar_events(user=None):
    """Activate broadcast messages for calendar events currently in progress."""
    now = timezone.now()

    qs = CalendarEvent.objects.exclude(broadcast_message='').filter(
        start_time__lte=now,
        end_time__gt=now,
    )
    if user is not None:
        qs = qs.filter(user=user)

    for event in qs:
        active = BroadcastMessage.objects.filter(
            user=event.user, active=True, message=event.broadcast_message,
        ).first()
        if active:
            continue
        remaining_seconds = (event.end_time - now).total_seconds()
        remaining_minutes = max(1, int(remaining_seconds / 60))
        _activate_broadcast_for_user(
            event.user, event.broadcast_message, remaining_minutes,
        )
        # Also set availability if configured
        if event.set_availability:
            UserDetails.objects.filter(user=event.user).update(
                is_available=(event.set_availability == 'true')
            )


def run_all(user=None):
    """Execute all scheduled processing in order."""
    process_expiring_messages(user=user)
    process_recurring_schedules(user=user)
    process_calendar_events(user=user)
