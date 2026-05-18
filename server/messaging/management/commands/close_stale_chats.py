from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from messaging.models import ChatThread
from dashboard.models import UserDetails


class Command(BaseCommand):
    help = 'Close chat threads that have been inactive beyond the faculty auto_close_hours setting.'

    def handle(self, *args, **options):
        now = timezone.now()
        closed_count = 0

        active_threads = ChatThread.objects.filter(status='ACTIVE')

        for thread in active_threads:
            try:
                faculty_details = UserDetails.objects.get(user=thread.faculty)
                hours = faculty_details.auto_close_hours
                if hours is None:
                    continue  # Faculty set to "never auto-close"

                cutoff = now - timedelta(hours=hours)
                if thread.last_activity_at < cutoff:
                    thread.status = 'CLOSED'
                    thread.closed_at = now
                    thread.closed_by = None  # System close
                    thread.save(update_fields=['status', 'closed_at', 'closed_by'])
                    closed_count += 1

                    # Notify both parties
                    from messaging.chat_views import _send_chat_email, _should_notify, _get_client_base
                    client_base = _get_client_base()
                    for participant in [thread.student, thread.faculty]:
                        if _should_notify(participant, 'notify_chat_closed'):
                            if participant.role == 'STUDENT':
                                link = f'{client_base}/dashboard/student.html?tab=messages&thread={thread.id}'
                            else:
                                link = f'{client_base}/dashboard/home.html?tab=chats&thread={thread.id}'
                            body = (
                                f'Hi {participant.username},\n\n'
                                f'Your chat thread "{thread.subject}" was automatically closed '
                                f'due to {hours} hours of inactivity.\n\n'
                                f'View the thread: {link}\n\n'
                                f'— Sir Kothay'
                            )
                            _send_chat_email(
                                participant.email,
                                f'Chat Auto-Closed: {thread.subject} — Sir Kothay',
                                body,
                            )
            except UserDetails.DoesNotExist:
                continue

        self.stdout.write(self.style.SUCCESS(f'Closed {closed_count} stale chat thread(s).'))
