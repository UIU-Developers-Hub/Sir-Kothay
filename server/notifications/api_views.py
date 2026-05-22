from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from authApp.models import CustomUser
from dashboard.models import UserDetails, StudentInterest
from messaging.models import DirectMessage, ChatThread

from .models import StatusSubscription
from .serializers import StatusSubscriptionSerializer, SubscribeSerializer
from .services import send_email_async
from django.conf import settings


@api_view(['POST'])
@permission_classes([AllowAny])
def subscribe(request, user_slug):
    """Public — subscribe an email to a broadcaster's status updates."""
    user_details = get_object_or_404(UserDetails, _slug=user_slug)
    serializer = SubscribeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']
    notify_preference = serializer.validated_data.get('notify_preference', 'available')

    # Intercept: If email belongs to registered user, use StudentInterest
    registered_user = CustomUser.objects.filter(email=email).first()
    if registered_user:
        interest, created = StudentInterest.objects.get_or_create(
            student=registered_user,
            faculty=user_details.user,
            defaults={'notify_preference': notify_preference}
        )
        if not created and interest.notify_preference != notify_preference:
            interest.notify_preference = notify_preference
            interest.save(update_fields=['notify_preference'])
        
        msg = 'You will be notified for all updates.' if notify_preference == 'all' else 'You will be notified when this person is available.'
        return Response({'message': f'Added to your Dashboard: {msg}'}, status=status.HTTP_200_OK)

    # Standard anonymous flow
    sub, created = StatusSubscription.objects.get_or_create(
        email=email,
        broadcaster=user_details.user,
        defaults={'is_active': True, 'notify_preference': notify_preference},
    )
    
    needs_save = False
    if not created and not sub.is_active:
        sub.is_active = True
        needs_save = True
        
    if not created and sub.notify_preference != notify_preference:
        sub.notify_preference = notify_preference
        needs_save = True

    if needs_save:
        sub.save(update_fields=['is_active', 'notify_preference'])

    # Build client url
    client_base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', None)
    if not client_base:
        client_base = 'http://127.0.0.1:5500/client'
    manage_url = f'{client_base}/broadcast/manage.html?token={sub.unsubscribe_token}'
    
    pref_str = 'all updates' if notify_preference == 'all' else 'when they become available'
    subject = f'Subscription Confirmed: {user_details.user.username}'
    body = (
        f'Hi!\n\n'
        f'You have successfully subscribed to status updates for {user_details.user.username}.\n'
        f'You will be notified {pref_str}.\n\n'
        f'---\n'
        f'To manage or unsubscribe from these notifications, visit:\n{manage_url}\n'
    )
    send_email_async(subject, body, settings.DEFAULT_FROM_EMAIL, [email])

    msg = 'You will be notified for all updates.' if notify_preference == 'all' else 'You will be notified when this person is available.'
    return Response(
        {'message': msg},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def unsubscribe(request, token):
    """Public — one-click unsubscribe via token in email link."""
    sub = get_object_or_404(StatusSubscription, unsubscribe_token=token)
    sub.is_active = False
    sub.save(update_fields=['is_active'])
    return Response({'message': 'You have been unsubscribed.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_subscribers(request):
    """Authenticated — list all subscribers for the current broadcaster."""
    subs = StatusSubscription.objects.filter(broadcaster=request.user)
    serializer = StatusSubscriptionSerializer(subs, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_subscriber(request, pk):
    """Authenticated — remove a subscriber."""
    sub = get_object_or_404(StatusSubscription, pk=pk, broadcaster=request.user)
    sub.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


from django.core.signing import Signer, BadSignature
from dashboard.models import StudentInterest
from messaging.models import ChatThread

def get_email_from_token(token):
    try:
        return Signer().unsign(token)
    except BadSignature:
        pass
    sub = StatusSubscription.objects.filter(unsubscribe_token=token).first()
    if sub: return sub.email
    return None

@api_view(['POST'])
@permission_classes([AllowAny])
def manage_subscriptions(request):
    """Manage subscriptions and DMs. Takes email directly, no auth required as per user request."""
    email = request.data.get('email')
    token = request.data.get('token')
    
    if token and not email:
        email = get_email_from_token(token)
        
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    registered_user = CustomUser.objects.filter(email=email).first()
    action = request.data.get('action', 'fetch')

    if action == 'fetch':
        subs_data = []
        dms_data = []

        if registered_user:
            interests = StudentInterest.objects.filter(student=registered_user).select_related('faculty__details')
            subs_data = [
                {
                    'id': i.id,
                    'type': 'registered_sub',
                    'faculty': i.faculty.username,
                    'faculty_slug': getattr(i.faculty, 'details', None).slug if hasattr(i.faculty, 'details') else '',
                    'notify_preference': i.notify_preference,
                    'is_active': i.notify_preference != 'none',
                } for i in interests
            ]
            threads = ChatThread.objects.filter(student=registered_user, deleted_by_student=False).select_related('faculty')
            dms_data = [
                {
                    'id': t.id,
                    'type': 'registered_chat',
                    'faculty': t.faculty.username,
                    'subject': t.subject,
                    'allows_replies': t.status != 'CLOSED',
                    'is_closed': t.status == 'CLOSED',
                    'created_at': t.created_at,
                } for t in threads
            ]
            
            # Also include any anonymous DMs they might have sent before logging in
            dms = DirectMessage.objects.filter(sender_email=email).select_related('broadcaster')
            dms_data += [
                {
                    'id': m.id,
                    'type': 'anonymous_dm',
                    'faculty': m.broadcaster.username,
                    'subject': m.subject,
                    'allows_replies': m.allows_replies,
                    'is_closed': m.is_closed,
                    'created_at': m.created_at,
                } for m in dms
            ]
        else:
            subs = StatusSubscription.objects.filter(email=email).select_related('broadcaster__details')
            subs_data = [
                {
                    'id': s.id,
                    'type': 'anonymous_sub',
                    'faculty': s.broadcaster.username,
                    'faculty_slug': getattr(s.broadcaster, 'details', None).slug if hasattr(s.broadcaster, 'details') else '',
                    'notify_preference': s.notify_preference,
                    'is_active': s.is_active,
                } for s in subs
            ]
            dms = DirectMessage.objects.filter(sender_email=email).select_related('broadcaster')
            dms_data = [
                {
                    'id': m.id,
                    'type': 'anonymous_dm',
                    'faculty': m.broadcaster.username,
                    'subject': m.subject,
                    'allows_replies': m.allows_replies,
                    'is_closed': m.is_closed,
                    'created_at': m.created_at,
                } for m in dms
            ]

        return Response({'email': email, 'subscriptions': subs_data, 'messages': dms_data})
        
    elif action == 'update_sub':
        item_id = request.data.get('item_id')
        item_type = request.data.get('item_type')
        preference = request.data.get('preference')
        
        if preference not in ['all', 'available', 'none']:
            return Response({'error': 'Invalid preference'}, status=status.HTTP_400_BAD_REQUEST)
            
        if item_type == 'registered_sub' and registered_user:
            i = get_object_or_404(StudentInterest, pk=item_id, student=registered_user)
            faculty_name = i.faculty.username
            i.notify_preference = preference
            i.save(update_fields=['notify_preference'])
            res_pref = i.notify_preference
        else:
            s = get_object_or_404(StatusSubscription, pk=item_id, email=email)
            faculty_name = s.broadcaster.username
            if preference == 'none':
                s.is_active = False
            else:
                s.is_active = True
                s.notify_preference = preference
            s.save(update_fields=['is_active', 'notify_preference'])
            res_pref = preference
            
        subject = "Subscription Settings Updated"
        pref_str = "All Updates" if preference == 'all' else "When Available" if preference == 'available' else "No Updates"
        body = f"Your notification subscription for {faculty_name} has been updated to: {pref_str}.\n\nThank you,\nSir Kothay Team"
        send_email_async(subject, body, settings.DEFAULT_FROM_EMAIL, [email])
            
        return Response({'status': 'ok', 'preference': res_pref})
            
    elif action == 'close_dm':
        item_id = request.data.get('item_id')
        item_type = request.data.get('item_type')
        if item_type == 'registered_chat' and registered_user:
            t = get_object_or_404(ChatThread, pk=item_id, student=registered_user)
            t.status = 'CLOSED'
            t.closed_at = timezone.now()
            t.closed_by = registered_user
            t.save(update_fields=['status', 'closed_at', 'closed_by'])
            return Response({'status': 'ok', 'is_closed': True})
        else:
            m = get_object_or_404(DirectMessage, pk=item_id, sender_email=email)
            m.allows_replies = False
            m.is_closed = True
            m.save(update_fields=['allows_replies', 'is_closed'])
            return Response({'status': 'ok', 'is_closed': True})
            
    return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def request_manage_link(request):
    """Sends a magic link to manage subscriptions directly to the provided email."""
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if there are any active objects for this email
    registered_user = CustomUser.objects.filter(email=email).exists()
    has_sub = StatusSubscription.objects.filter(email=email).exists()
    has_dm = DirectMessage.objects.filter(sender_email=email).exists()
    
    if not (registered_user or has_sub or has_dm):
        return Response({'error': 'No active subscriptions or messages found for this email.'}, status=status.HTTP_404_NOT_FOUND)

    token = Signer().sign(email)
    frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://127.0.0.1:5500/client'
    link = f"{frontend_url}/broadcast/manage.html?token={token}"
    
    subject = "Manage Your Sir Kothay Notifications"
    body = f"Click the link below to securely manage your notification subscriptions and direct messages:\n\n{link}\n\nThis link acts as your password, do not share it."
    
    send_email_async(subject, body, settings.DEFAULT_FROM_EMAIL, [email])
    
    return Response({'status': 'ok'})
