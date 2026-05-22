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


def _activate_broadcast_for_user(user, message_text, duration_seconds=None, set_availability=None):
    """Create-and-activate a broadcast message for *user* with the given text."""
    BroadcastMessage.objects.filter(user=user, active=True).update(active=False)
    msg = BroadcastMessage.objects.create(
        user=user,
        message=message_text,
        active=True,
        duration_seconds=duration_seconds,
        set_availability=set_availability,
    )
    return msg





def process_recurring_schedules(user=None):
    """Check if any recurring schedule should fire right now."""
    now_utc = timezone.now()
    now_local = timezone.localtime(now_utc)
    current_dow = now_local.weekday()
    current_time = now_local.time()
    window_start = (now_local - timedelta(minutes=6)).time()

    qs = RecurringSchedule.objects.filter(is_active=True, day_of_week=current_dow)
    if user is not None:
        qs = qs.filter(user=user)

    for sched in qs:
        if window_start <= current_time:
            matches_time = window_start <= sched.time_of_day <= current_time
        else:
            matches_time = sched.time_of_day >= window_start or sched.time_of_day <= current_time
            
        if not matches_time:
            continue
        if sched.last_triggered_at:
            if (now_utc - sched.last_triggered_at) < timedelta(minutes=10):
                continue

        _activate_broadcast_for_user(
            sched.user, sched.message, sched.duration_seconds, sched.set_availability
        )
        sched.last_triggered_at = now_utc
        sched.save(update_fields=['last_triggered_at'])


def process_calendar_events(user=None):
    """Activate broadcast messages for calendar events currently in progress."""
    now = timezone.now()

    qs = CalendarEvent.objects.filter(is_active=True).exclude(title='').filter(
        start_time__lte=now,
        end_time__gt=now,
    )
    if user is not None:
        qs = qs.filter(user=user)

    for event in qs:
        active = BroadcastMessage.objects.filter(
            user=event.user, active=True, message=event.title,
        ).first()
        if active:
            continue
        remaining_seconds = (event.end_time - now).total_seconds()
        _activate_broadcast_for_user(
            event.user, event.title, remaining_seconds, event.set_availability
        )


def run_all(user=None):
    """Execute all scheduled processing in order."""


    from broadcast.models import BroadcastMessage
    BroadcastMessage.activate_due_messages(user=user)
    
    from messaging.services import process_stale_chats
    process_stale_chats()
