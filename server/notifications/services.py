"""Email notification service for both audience subscribers and registered students."""
import logging
import threading
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.signing import Signer
from django.template.loader import render_to_string

from .models import StatusSubscription
from dashboard.models import StudentInterest, UserDetails

logger = logging.getLogger(__name__)

DEFAULT_CLIENT_BASE_URL = 'http://127.0.0.1:5500/client'


def get_client_base_url():
    """Return the configured public client root without a trailing slash."""
    for setting_name in ('CLIENT_PUBLIC_BASE_URL', 'FRONTEND_URL'):
        base = getattr(settings, setting_name, '')
        if base:
            return str(base).strip().rstrip('/')
    return DEFAULT_CLIENT_BASE_URL


def build_client_url(path, params=None):
    """Build a public client URL while keeping email links consistent."""
    base = get_client_base_url()
    clean_path = str(path).lstrip('/')
    url = f'{base}/{clean_path}'
    clean_params = {
        key: value for key, value in (params or {}).items()
        if value is not None and value != ''
    }
    if clean_params:
        url = f'{url}?{urlencode(clean_params)}'
    return url


def auth_login_url():
    return build_client_url('auth/login.html')


def verify_email_url(token):
    return build_client_url('auth/verify-email.html', {'token': token})


def reset_password_url(uidb64, token):
    return build_client_url('auth/reset-password.html', {'uidb64': uidb64, 'token': token})


def dashboard_url_for_user(user, tab=None, thread_id=None, extra_params=None):
    """Return the right dashboard entry point for a registered account."""
    if getattr(user, 'role', '') == 'STUDENT':
        path = 'dashboard/student.html'
        tab = tab or 'messages'
    else:
        path = 'dashboard/home.html'
        tab = tab or 'inbox'

    params = {'tab': tab}
    if thread_id:
        params['thread'] = thread_id
    if extra_params:
        params.update(extra_params)
    return build_client_url(path, params)


def chat_thread_url(user, thread_id):
    """Deep-link to a chat thread using the route each dashboard already supports."""
    if getattr(user, 'role', '') == 'STUDENT':
        return dashboard_url_for_user(user, tab='messages', thread_id=thread_id)
    return build_client_url('dashboard/home.html', {'tab': 'chats', 'thread': thread_id})


def public_broadcast_url(user):
    try:
        slug = user.details.slug
    except UserDetails.DoesNotExist:
        slug = ''
    if not slug:
        return ''
    return build_client_url('broadcast/message.html', {'user': slug})


def manage_link_for_email(email, subscription=None, token=None):
    """Build the anonymous/magic management link for visitor email flows."""
    if token is None and subscription is not None:
        token = getattr(subscription, 'unsubscribe_token', None)
    if token is None:
        token = Signer().sign(email)
    return build_client_url('broadcast/manage.html', {'token': token})


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    return [item for item in value if item]


def _body_to_paragraphs(body):
    return [chunk.strip() for chunk in str(body or '').split('\n\n') if chunk.strip()]


def _normalize_pairs(items):
    normalized = []
    for item in items or []:
        if isinstance(item, dict):
            label = item.get('label')
            value = item.get('value')
        else:
            label, value = item
        if label and value not in (None, ''):
            normalized.append({'label': label, 'value': value})
    return normalized


def _normalize_actions(actions):
    normalized = []
    for action in actions or []:
        if isinstance(action, dict):
            label = action.get('label')
            url = action.get('url')
        else:
            label, url = action
        if label and url:
            normalized.append({'label': label, 'url': url})
    return normalized


def _render_html_email(subject, body, **options):
    intro = options.get('intro')
    if intro is None:
        intro = _body_to_paragraphs(body)

    context = {
        'subject': subject,
        'preheader': options.get('preheader') or subject,
        'eyebrow': options.get('eyebrow') or 'Sir Kothay',
        'badge': options.get('badge') or '',
        'title': options.get('title') or subject,
        'greeting': options.get('greeting') or '',
        'intro': _as_list(intro),
        'facts': _normalize_pairs(options.get('facts')),
        'code': options.get('code') or '',
        'quote_label': options.get('quote_label') or '',
        'quote': options.get('quote') or '',
        'sections': options.get('sections') or [],
        'action_label': options.get('action_label') or '',
        'action_url': options.get('action_url') or '',
        'secondary_actions': _normalize_actions(options.get('secondary_actions')),
        'footer_note': options.get('footer_note') or '',
        'support_note': options.get('support_note') or 'This email was sent by Sir Kothay.',
    }
    return render_to_string('notifications/email/base.html', context)


def _send_email_async_worker(subject, body, from_email, recipient_list, html_message=None, fail_silently=False):
    """Worker running in a daemon thread to send email without blocking the request."""
    try:
        message = EmailMultiAlternatives(subject, body, from_email, recipient_list)
        if html_message:
            message.attach_alternative(html_message, 'text/html')
        message.send(fail_silently=fail_silently)
    except Exception as e:
        logger.exception("Background email sending failed to %s: %s", recipient_list, e)


def send_email_async(subject, body, from_email, recipient_list, **email_options):
    """Helper to dispatch emails asynchronously in the background."""
    fail_silently = email_options.pop('fail_silently', False)
    html_message = None
    try:
        html_message = _render_html_email(subject, body, **email_options)
    except Exception as e:
        logger.exception("HTML email rendering failed for %s: %s", recipient_list, e)

    t = threading.Thread(
        target=_send_email_async_worker,
        args=(subject, body, from_email, recipient_list, html_message, fail_silently)
    )
    t.daemon = True
    t.start()


def _client_base():
    """Best-effort base URL for building links."""
    return get_client_base_url()


def notify_broadcaster_status_change(broadcaster, message_text, new_is_available, was_available=None):
    """Send emails to both anonymous subscribers and registered students based on status and availability changes.

    - Anonymous subscribers (StatusSubscription): notified only when the broadcaster becomes available.
    - Registered students (StudentInterest): notified based on their granular preference:
      * 'all': notified on any status update or availability update.
      * 'available': notified only when the broadcaster becomes available.
    """
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    # Get the previous availability to detect "becoming available" transition
    if was_available is None:
        try:
            details = UserDetails.objects.get(user=broadcaster)
            was_available = details.is_available
        except UserDetails.DoesNotExist:
            was_available = False

    just_became_available = (not was_available and new_is_available)

    # --- 1. Notify Anonymous Subscribers ---
    subs = StatusSubscription.objects.filter(broadcaster=broadcaster, is_active=True)
    for sub in subs:
        should_notify = False
        pref = getattr(sub, 'notify_preference', 'available')
        
        if pref == 'all':
            should_notify = True
        elif pref == 'available' and just_became_available:
            should_notify = True
            
        if should_notify:
            avail_str = "Available" if new_is_available else "Unavailable"
            subject = f'Update from {broadcaster.username}'
            manage_url = manage_link_for_email(sub.email, subscription=sub)
            profile_url = public_broadcast_url(broadcaster)
            body = (
                f'Hi!\n\n'
                f'Faculty member {broadcaster.username} has updated their status/availability:\n\n'
                f'Current Update / Event: "{message_text}"\n'
                f'Availability: {avail_str}\n\n'
                f'Visit their page to learn more:\n{profile_url or manage_url}\n\n'
                f'---\n'
                f'Manage your subscriptions:\n{manage_url}\n'
            )
            secondary_actions = []
            if profile_url:
                secondary_actions.append({'label': 'Manage subscription', 'url': manage_url})
            send_email_async(
                subject,
                body,
                from_email,
                [sub.email],
                eyebrow='Status update',
                badge=avail_str,
                title=f'{broadcaster.username} updated their status',
                greeting='there',
                intro=['A faculty member you follow has a new status update.'],
                facts=[('Faculty', broadcaster.username), ('Availability', avail_str)],
                quote_label='Current update',
                quote=message_text,
                action_label='View public page' if profile_url else 'Manage subscription',
                action_url=profile_url or manage_url,
                secondary_actions=secondary_actions,
                footer_note='You received this because this email is subscribed to public status updates.',
            )

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
            dashboard_link = dashboard_url_for_user(
                student,
                tab='faculties',
                extra_params={'faculty': broadcaster.id, 'highlight': 'faculty-update'},
            )
            profile_url = public_broadcast_url(broadcaster)

            body = (
                f'Hi {student.username},\n\n'
                f'Faculty member {broadcaster.username} has updated their status/availability:\n\n'
                f'Current Update / Event: "{message_text}"\n'
                f'Availability: {avail_str}\n\n'
                f'You received this because you enabled updates for {broadcaster.username}.\n\n'
                f'View their live updates from your dashboard: {dashboard_link}\n\n'
                f'— Sir Kothay'
            )
            secondary_actions = []
            if profile_url:
                secondary_actions.append({'label': 'Open public page', 'url': profile_url})
            send_email_async(
                subject,
                body,
                from_email,
                [student.email],
                eyebrow='Dashboard update',
                badge=avail_str,
                title=f'{broadcaster.username} updated their status',
                greeting=student.username,
                intro=['A faculty member in your dashboard has a new update.'],
                facts=[('Faculty', broadcaster.username), ('Availability', avail_str)],
                quote_label='Current update',
                quote=message_text,
                action_label='Open dashboard',
                action_url=dashboard_link,
                secondary_actions=secondary_actions,
                footer_note=f'You received this because you enabled updates for {broadcaster.username}.',
            )


# Retain compatibility for legacy callers of notify_subscribers
def notify_subscribers(broadcaster, message_text):
    """Wrapper calling the new unified status change system assuming the broadcaster is now available."""
    return notify_broadcaster_status_change(broadcaster, message_text, new_is_available=True)
