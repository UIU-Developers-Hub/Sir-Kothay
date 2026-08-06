from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from authApp.models import CustomUser
from scheduler.models import CalendarEvent, RecurringSchedule
from scheduler.services import process_calendar_events

from .models import BroadcastMessage


class BroadcastRestorationTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email='faculty@example.com',
            username='faculty',
            password='StrongPass123!',
            role='FACULTY',
        )

    def active_message(self):
        return BroadcastMessage.objects.filter(user=self.user, active=True).first()

    def test_interrupted_timed_status_resumes_for_its_remaining_window(self):
        older = BroadcastMessage.objects.create(
            user=self.user,
            message='Office hours',
            duration_seconds=3600,
            active=True,
        )
        original_end = older.active_until
        newer = BroadcastMessage.objects.create(
            user=self.user,
            message='Quick interruption',
            duration_seconds=60,
            active=True,
        )
        older.refresh_from_db()
        self.assertFalse(older.active)

        BroadcastMessage.objects.filter(pk=newer.pk).update(active_until=timezone.now() - timedelta(seconds=1))
        BroadcastMessage.activate_due_messages(user=self.user)

        older.refresh_from_db()
        self.assertTrue(older.active)
        self.assertEqual(older.active_until, original_end)

    def test_expiry_without_a_predecessor_restores_default_availability(self):
        details = self.user.details
        details.default_availability = True
        details.is_available = False
        details.save(update_fields=['default_availability', 'is_available'])
        message = BroadcastMessage.objects.create(
            user=self.user,
            message='Temporary status',
            duration_seconds=60,
            active=True,
            set_availability='false',
        )
        BroadcastMessage.objects.filter(pk=message.pk).update(
            active_until=timezone.now() - timedelta(seconds=1),
        )

        BroadcastMessage.activate_due_messages(user=self.user)

        details.refresh_from_db()
        self.assertTrue(details.is_available)
        self.assertFalse(BroadcastMessage.objects.filter(user=self.user, active=True).exists())

    def test_calendar_occurrence_resumes_after_newer_status_ends(self):
        now = timezone.now()
        event = CalendarEvent.objects.create(
            user=self.user,
            title='Scheduled class',
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
        )
        BroadcastMessage.activate_due_messages(user=self.user)
        occurrence = self.active_message()
        self.assertEqual(occurrence.source_type, BroadcastMessage.SOURCE_CALENDAR)
        self.assertEqual(occurrence.source_id, event.pk)

        newer = BroadcastMessage.objects.create(
            user=self.user,
            message='Emergency update',
            duration_seconds=60,
            active=True,
        )
        BroadcastMessage.objects.filter(pk=newer.pk).update(active_until=timezone.now() - timedelta(seconds=1))
        BroadcastMessage.activate_due_messages(user=self.user)

        occurrence.refresh_from_db()
        self.assertTrue(occurrence.active)
        self.assertEqual(occurrence.active_until, event.end_time)


class ScheduleOccurrenceControlTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email='faculty-control@example.com',
            username='faculty-control',
            password='StrongPass123!',
            role='FACULTY',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_stop_suppresses_only_current_daily_occurrence_and_go_live_preserves_end(self):
        now = timezone.now()
        event = CalendarEvent.objects.create(
            user=self.user,
            title='Daily advising',
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
            recurrence_rule='daily',
        )
        BroadcastMessage.activate_due_messages(user=self.user)
        occurrence = BroadcastMessage.objects.get(
            source_type=BroadcastMessage.SOURCE_CALENDAR,
            source_id=event.pk,
        )
        original_end = occurrence.active_until

        occurrence.active = False
        occurrence.save(update_fields=['active'])
        occurrence.refresh_from_db()
        self.assertTrue(occurrence.manually_stopped)
        BroadcastMessage.activate_due_messages(user=self.user)
        self.assertFalse(BroadcastMessage.objects.filter(user=self.user, active=True).exists())

        response = self.client.post(f'/api/broadcast/messages/{occurrence.pk}/set_active/')
        self.assertEqual(response.status_code, 200)
        occurrence.refresh_from_db()
        self.assertTrue(occurrence.active)
        self.assertFalse(occurrence.manually_stopped)
        self.assertEqual(occurrence.active_until, original_end)

        occurrence.active = False
        occurrence.save(update_fields=['active'])
        tomorrow = now + timedelta(days=1)
        affected = process_calendar_events(user=self.user, now=tomorrow)
        self.assertIn(self.user.pk, affected)
        BroadcastMessage.reconcile_user(self.user.pk, now=tomorrow)

        next_occurrence = BroadcastMessage.objects.filter(
            source_type=BroadcastMessage.SOURCE_CALENDAR,
            source_id=event.pk,
        ).exclude(pk=occurrence.pk).get()
        self.assertTrue(next_occurrence.active)
        event.refresh_from_db()
        self.assertTrue(event.is_active)

    def test_pausing_and_deleting_sources_remove_their_live_occurrences(self):
        now = timezone.now()
        event = CalendarEvent.objects.create(
            user=self.user,
            title='Live event',
            start_time=now - timedelta(minutes=5),
            end_time=now + timedelta(minutes=30),
        )
        BroadcastMessage.activate_due_messages(user=self.user)
        self.assertTrue(BroadcastMessage.objects.filter(source_type='calendar', source_id=event.pk, active=True).exists())

        response = self.client.patch(
            f'/api/scheduler/calendar/{event.pk}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(BroadcastMessage.objects.filter(source_type='calendar', source_id=event.pk).exists())
        self.assertFalse(BroadcastMessage.objects.filter(user=self.user, active=True).exists())

        local_now = timezone.localtime(now)
        schedule = RecurringSchedule.objects.create(
            user=self.user,
            message='Recurring office hour',
            day_of_week=local_now.weekday(),
            time_of_day=(local_now - timedelta(minutes=5)).time(),
            duration_seconds=1800,
        )
        BroadcastMessage.activate_due_messages(user=self.user)
        self.assertTrue(BroadcastMessage.objects.filter(source_type='recurring', source_id=schedule.pk, active=True).exists())

        response = self.client.delete(f'/api/scheduler/recurring/{schedule.pk}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(BroadcastMessage.objects.filter(source_type='recurring', source_id=schedule.pk).exists())
        self.assertFalse(BroadcastMessage.objects.filter(user=self.user, active=True).exists())
