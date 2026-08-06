"""Shared scheduling and occurrence reconciliation services."""
import calendar
from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from broadcast.models import BroadcastMessage

from .models import CalendarEvent, RecurringSchedule


def _occurrence_key(start):
    return start.isoformat()


def _ensure_occurrence(*, user, source_type, source_id, start, end, message, set_availability=''):
    """Create one durable broadcast row for a concrete schedule occurrence."""
    key = _occurrence_key(start)
    duration_seconds = None
    if end is not None:
        duration_seconds = max(1, int((end - start).total_seconds()))

    defaults = {
        'user': user,
        'message': message,
        'active': False,
        'scheduled_for': start,
        'duration_seconds': duration_seconds,
        'active_until': end,
        'set_availability': set_availability or '',
        'started_at': start,
    }
    try:
        with transaction.atomic():
            occurrence, created = BroadcastMessage.objects.get_or_create(
                source_type=source_type,
                source_id=source_id,
                occurrence_key=key,
                defaults=defaults,
            )
    except IntegrityError:
        occurrence = BroadcastMessage.objects.get(
            source_type=source_type,
            source_id=source_id,
            occurrence_key=key,
        )
        created = False

    if not created:
        changed = []
        desired = {
            'message': message,
            'scheduled_for': start,
            'duration_seconds': duration_seconds,
            'active_until': end,
            'set_availability': set_availability or '',
            'user_id': user.pk,
        }
        for field, value in desired.items():
            if getattr(occurrence, field) != value:
                setattr(occurrence, field, value)
                changed.append(field)
        if changed:
            occurrence.save(update_fields=changed)

    return occurrence, created


def _latest_recurring_bounds(schedule, now):
    now_local = timezone.localtime(now)
    days_since = (now_local.weekday() - schedule.day_of_week) % 7
    occurrence_date = now_local.date() - timedelta(days=days_since)
    naive_start = datetime.combine(occurrence_date, schedule.time_of_day)
    start = timezone.make_aware(naive_start, timezone.get_current_timezone())
    if start > now_local:
        start -= timedelta(days=7)

    # A never-triggered newly-created rule must not backfill last week's
    # indefinite occurrence before its first configured start time.
    if (
        schedule.last_triggered_at is None
        and schedule.duration_seconds is None
        and start.date() < now_local.date()
    ):
        return None

    end = start + timedelta(seconds=schedule.duration_seconds) if schedule.duration_seconds else None
    if end is not None and end <= now_local:
        return None
    return start, end


def _monthly_start(base_start, year, month):
    day = min(base_start.day, calendar.monthrange(year, month)[1])
    return base_start.replace(year=year, month=month, day=day)


def _previous_month(year, month):
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _current_calendar_bounds(event, now):
    start = timezone.localtime(event.start_time)
    end = timezone.localtime(event.end_time)
    now_local = timezone.localtime(now)
    duration = end - start

    if event.recurrence_rule == 'none':
        candidate_start, candidate_end = start, end
    elif event.recurrence_rule == 'daily':
        candidate_start = start.replace(
            year=now_local.year,
            month=now_local.month,
            day=now_local.day,
        )
        if candidate_start > now_local:
            candidate_start -= timedelta(days=1)
        candidate_end = candidate_start + duration
    elif event.recurrence_rule == 'weekly':
        days_since = (now_local.weekday() - start.weekday()) % 7
        candidate_start = start.replace(
            year=now_local.year,
            month=now_local.month,
            day=now_local.day,
        ) - timedelta(days=days_since)
        if candidate_start > now_local:
            candidate_start -= timedelta(days=7)
        candidate_end = candidate_start + duration
    elif event.recurrence_rule == 'monthly':
        candidate_start = _monthly_start(start, now_local.year, now_local.month)
        if candidate_start > now_local:
            year, month = _previous_month(now_local.year, now_local.month)
            candidate_start = _monthly_start(start, year, month)
        candidate_end = candidate_start + duration
    else:
        return None

    if candidate_start < start or not (candidate_start <= now_local < candidate_end):
        return None
    return candidate_start, candidate_end


def process_recurring_schedules(user=None, now=None):
    """Materialize every currently-valid recurring schedule occurrence."""
    now = now or timezone.now()
    affected_user_ids = set()
    schedules = RecurringSchedule.objects.filter(is_active=True)
    if user is not None:
        schedules = schedules.filter(user=user)

    for schedule in schedules:
        bounds = _latest_recurring_bounds(schedule, now)
        if bounds is None:
            continue
        start, end = bounds
        _, created = _ensure_occurrence(
            user=schedule.user,
            source_type=BroadcastMessage.SOURCE_RECURRING,
            source_id=schedule.pk,
            start=start,
            end=end,
            message=schedule.message,
            set_availability=schedule.set_availability,
        )
        affected_user_ids.add(schedule.user_id)
        if created or schedule.last_triggered_at is None or schedule.last_triggered_at < start:
            schedule.last_triggered_at = now
            schedule.save(update_fields=['last_triggered_at'])

    return affected_user_ids


def process_calendar_events(user=None, now=None):
    """Materialize calendar occurrences that are currently in progress."""
    now = now or timezone.now()
    affected_user_ids = set()
    events = CalendarEvent.objects.filter(is_active=True).exclude(title='')
    if user is not None:
        events = events.filter(user=user)

    for event in events:
        bounds = _current_calendar_bounds(event, now)
        if bounds is None:
            continue
        start, end = bounds
        _ensure_occurrence(
            user=event.user,
            source_type=BroadcastMessage.SOURCE_CALENDAR,
            source_id=event.pk,
            start=start,
            end=end,
            message=event.title,
            set_availability=event.set_availability,
        )
        affected_user_ids.add(event.user_id)

    return affected_user_ids


def remove_source_occurrences(source_type, source_id):
    """Remove generated rows for an edited, paused, or deleted source."""
    rows = BroadcastMessage.objects.filter(source_type=source_type, source_id=source_id)
    user_id = rows.values_list('user_id', flat=True).first()
    had_active = rows.filter(active=True).exists()
    rows.delete()
    return user_id, had_active


def resync_user(user, fallback_if_empty=False):
    BroadcastMessage.activate_due_messages(user=user)
    if fallback_if_empty and not BroadcastMessage.objects.filter(user=user, active=True).exists():
        BroadcastMessage._revert_to_default(user.pk)


def run_all(user=None):
    """Execute scheduled status and stale-chat processing."""
    BroadcastMessage.activate_due_messages(user=user)

    from messaging.services import process_stale_chats
    process_stale_chats()
