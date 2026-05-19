"""Email notification service for both audience subscribers and registered students."""
import logging
import threading
from django.conf import settings
from django.core.mail import send_mail
from .models import StatusSubscription
from dashboard.models import StudentInterest, UserDetails

logger = logging.getLogger(__name__)


def _send_email_async_worker(subject, body, from_email, recipient_list):
    """Worker running in a daemon thread to send email without blocking the request."""
    try:
        send_mail(subject, body, from_email, recipient_list, fail_silently=False)
    except Exception as e:
        logger.exception("Background email sending failed to %s: %s", recipient_list, e)


def send_email_async(subject, body, from_email, recipient_list):
    """Helper to dispatch emails asynchronously in the background."""
    t = threading.Thread(
        target=_send_email_async_worker,
        args=(subject, body, from_email, recipient_list)
    )
    t.daemon = True
    t.start()


def _client_base():
    """Best-effort base URL for building links."""
    base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', '').strip().rstrip('/')
    if base:
        return base
    hosts = getattr(settings, 'ALLOWED_HOSTS', ['127.0.0.1'])
    host = hosts[0] if hosts else '127.0.0.1'
    return f'http://{host}:8000'


def notify_broadcaster_status_change(broadcaster, message_text, new_is_available, was_available=None):
    """Send emails to both anonymous subscribers and registered students based on status and availability changes.

    - Anonymous subscribers (StatusSubscription): notified only when the broadcaster becomes available.
    - Registered students (StudentInterest): notified based on their granular preference:
      * 'all': notified on any status update or availability update.
      * 'available': notified only when the broadcaster becomes available.
    """
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    client_base = _client_base()

    # Get the previous availability to detect "becoming available" transition
    if was_available is None:
        try:
            details = UserDetails.objects.get(user=broadcaster)
            was_available = details.is_available
        except UserDetails.DoesNotExist:
            was_available = False

    just_became_available = (not was_available and new_is_available)

    # --- 1. Notify Anonymous Subscribers (only when becoming available) ---
    if just_became_available:
        subs = StatusSubscription.objects.filter(broadcaster=broadcaster, is_active=True)
        subject = f'{broadcaster.username} is now available!'
        for sub in subs:
            unsubscribe_url = f'{client_base}/api/notifications/unsubscribe/{sub.unsubscribe_token}/'
            body = (
                f'Hi!\n\n'
                f'{broadcaster.username} just updated their status and is now available:\n\n'
                f'"{message_text}"\n\n'
                f'Visit their page to learn more.\n\n'
                f'---\n'
                f'To unsubscribe from these notifications, visit:\n{unsubscribe_url}\n'
            )
            send_email_async(subject, body, from_email, [sub.email])

    # --- 2. Notify Registered Students based on their notify_preference tier ---
    interests = StudentInterest.objects.filter(faculty=broadcaster)
    for interest in interests:
        pref = interest.notify_preference
        should_notify = False

        if pref == 'all':
            should_notify = True
        elif pref == 'available' and just_became_available:
            should_notify = True

        if should_notify:
            student = interest.student
            subject = f'Update from {broadcaster.username}'
            avail_str = "Available" if new_is_available else "Unavailable"
            # Deep link directly to the student messages dashboard tab
            dashboard_link = f'{client_base}/dashboard/student.html?tab=messages'

            body = (
                f'Hi {student.username},\n\n'
                f'Faculty member {broadcaster.username} has updated their status/availability:\n\n'
                f'Status: "{message_text}"\n'
                f'Availability: {avail_str}\n\n'
                f'You received this because you enabled updates for {broadcaster.username}.\n\n'
                f'View their live updates and chat: {dashboard_link}\n\n'
                f'— Sir Kothay'
            )
            send_email_async(subject, body, from_email, [student.email])


# Retain compatibility for legacy callers of notify_subscribers
def notify_subscribers(broadcaster, message_text):
    """Wrapper calling the new unified status change system assuming the broadcaster is now available."""
    return notify_broadcaster_status_change(broadcaster, message_text, new_is_available=True)
