import hmac
import hashlib
import subprocess
import os
import logging

from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

logger = logging.getLogger(__name__)


@csrf_exempt
def github_webhook(request):
    if request.method != "POST":
        return JsonResponse({"status": "Invalid method"}, status=405)

    # 1. Verify the signature — ALWAYS required, never skip
    secret = os.getenv('GITHUB_WEBHOOK_SECRET', '').strip()
    if not secret:
        logger.error("GITHUB_WEBHOOK_SECRET is not set. Rejecting webhook.")
        return HttpResponseForbidden("Webhook secret not configured on server")

    signature = request.headers.get('X-Hub-Signature-256')
    if not signature:
        return HttpResponseForbidden("Missing signature header")

    mac = hmac.new(secret.encode(), msg=request.body, digestmod=hashlib.sha256)
    expected_signature = f"sha256={mac.hexdigest()}"
    if not hmac.compare_digest(expected_signature, signature):
        return HttpResponseForbidden("Invalid signature")

    # 2. Trigger the deployment script in the background
    script_path = os.path.join(settings.BASE_DIR.parent, 'scripts', 'deploy_pythonanywhere.sh')

    if not os.path.exists(script_path):
        return JsonResponse({"status": "Deploy script not found. Are you running locally?"}, status=400)

    try:
        subprocess.Popen(
            ['/bin/bash', script_path],
            close_fds=True,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        logger.exception("Failed to launch deploy script")
        return JsonResponse({"status": "Failed to start deployment", "error": str(e)}, status=500)

    return JsonResponse({"status": "Deployment started"})
