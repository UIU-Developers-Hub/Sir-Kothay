"""Email notification service for audience subscribers."""
import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import StatusSubscription

logger = logging.getLogger(__name__)


def notify_subscribers(broadcaster, message_text):
    """Send an email to every active subscriber of *broadcaster*.

    Called when the broadcaster's status changes to something containing
    "available" (case-insensitive), or whenever the broadcaster explicitly
    triggers notifications.
    """
    subs = StatusSubscription.objects.filter(
        broadcaster=broadcaster,
        is_active=True,
    )
    if not subs.exists():
        return 0

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    subject = f'{broadcaster.username} is now available!'
    sent = 0

    for sub in subs:
        unsubscribe_url = f'{_client_base()}/api/notifications/unsubscribe/{sub.unsubscribe_token}/'
        body = (
            f'Hi!\n\n'
            f'{broadcaster.username} just updated their status:\n\n'
            f'"{message_text}"\n\n'
            f'Visit their page to learn more.\n\n'
            f'---\n'
            f'To unsubscribe from these notifications, visit:\n{unsubscribe_url}\n'
        )
        try:
            send_mail(subject, body, from_email, [sub.email], fail_silently=True)
            sent += 1
        except Exception:
            logger.exception('Failed to send notification to %s', sub.email)

    return sent


def _client_base():
    """Best-effort base URL for building unsubscribe links."""
    base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', '').strip().rstrip('/')
    if base:
        return base
    hosts = getattr(settings, 'ALLOWED_HOSTS', ['127.0.0.1'])
    host = hosts[0] if hosts else '127.0.0.1'
    return f'http://{host}:8000'
