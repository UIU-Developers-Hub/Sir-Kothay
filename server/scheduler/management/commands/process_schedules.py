"""Management command to process all scheduled tasks.

Run via PythonAnywhere scheduled tasks or cron:
    python manage.py process_schedules

Processes:
  - Expiring broadcast messages (revert to default status)
  - Recurring schedule triggers
  - Calendar event broadcast sync
"""
from django.core.management.base import BaseCommand

from scheduler.services import run_all


class Command(BaseCommand):
    help = 'Process recurring schedules, calendar events, and expiring messages.'

    def handle(self, *args, **options):
        run_all()
        self.stdout.write(self.style.SUCCESS('All schedules processed.'))
