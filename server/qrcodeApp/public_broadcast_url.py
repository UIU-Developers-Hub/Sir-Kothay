"""Resolve the absolute URL encoded in user QR codes (public broadcast landing page)."""
import socket
from urllib.parse import urlencode

from django.conf import settings
from django.urls import reverse


def _get_lan_ip() -> str:
    """Auto-detect the machine's LAN IP so QR codes work from mobile devices."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Doesn't actually send traffic; just forces OS to pick the outbound interface
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


# Default client port used by python -m http.server or Live Server
_CLIENT_PORT = 5500


def public_broadcast_qr_url(request, user_slug: str) -> str:
    """
    Build the URL to encode in QR codes.

    Priority:
      1. CLIENT_PUBLIC_BASE_URL from settings/.env (production or explicit override)
      2. Auto-detect LAN IP so scans from mobile devices on the same Wi-Fi work
      3. Fall back to the legacy Django /broadcast/<slug>/ URL
    """
    base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', '').strip().rstrip('/')

    # If base is a loopback address, replace it with LAN IP for mobile access
    if base:
        for loopback in ('://127.0.0.1', '://localhost', '://[::1]'):
            if loopback in base:
                lan_ip = _get_lan_ip()
                if lan_ip != '127.0.0.1':
                    base = base.replace(loopback.split('://')[1], lan_ip)
                break

    if base:
        return f'{base}/broadcast/message.html?{urlencode({"user": user_slug})}'

    # Auto-detect: build a LAN-accessible client URL
    lan_ip = _get_lan_ip()
    if lan_ip != '127.0.0.1':
        return f'http://{lan_ip}:{_CLIENT_PORT}/broadcast/message.html?{urlencode({"user": user_slug})}'

    return request.build_absolute_uri(
        reverse('show_broadcast_messages', kwargs={'user_slug': user_slug})
    )
