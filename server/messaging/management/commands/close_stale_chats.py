from django.core.management.base import BaseCommand
from messaging.services import process_stale_chats

class Command(BaseCommand):
    help = 'Close chat threads that have been inactive beyond the faculty auto_close_seconds setting.'

    def handle(self, *args, **options):
        closed_count = process_stale_chats()
        self.stdout.write(self.style.SUCCESS(f'Closed {closed_count} stale chat thread(s).'))
