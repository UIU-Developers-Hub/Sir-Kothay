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
from .services import (
    dashboard_url_for_user,
    manage_link_for_email,
    public_broadcast_url,
    send_email_async,
)
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
        dashboard_link = dashboard_url_for_user(
            registered_user,
            tab='faculties' if registered_user.role == 'STUDENT' else None,
        )
        profile_url = public_broadcast_url(user_details.user)
        pref_str = 'all updates' if notify_preference == 'all' else 'when they become available'
        subject = f'Subscription Confirmed: {user_details.user.username}'
        body = (
            f'Hi {registered_user.username},\n\n'
            f'You have successfully subscribed to status updates for {user_details.user.username}.\n'
            f'You will be notified {pref_str}.\n\n'
            f'Manage this from your dashboard:\n{dashboard_link}\n\n'
            f'Thanks,\nSir Kothay Team'
        )
        secondary_actions = []
        if profile_url:
            secondary_actions.append({'label': 'Open public page', 'url': profile_url})
        send_email_async(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            eyebrow='Subscription',
            title=f'Updates enabled for {user_details.user.username}',
            greeting=registered_user.username,
            intro=[f'Your Sir Kothay account will receive {pref_str} for this faculty member.'],
            facts=[('Faculty', user_details.user.username), ('Preference', msg)],
            action_label='Open dashboard',
            action_url=dashboard_link,
            secondary_actions=secondary_actions,
            footer_note='You received this because this email belongs to a registered Sir Kothay account.',
        )
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

    manage_url = manage_link_for_email(email, subscription=sub)
    profile_url = public_broadcast_url(user_details.user)
    
    pref_str = 'all updates' if notify_preference == 'all' else 'when they become available'
    subject = f'Subscription Confirmed: {user_details.user.username}'
    body = (
        f'Hi!\n\n'
        f'You have successfully subscribed to status updates for {user_details.user.username}.\n'
        f'You will be notified {pref_str}.\n\n'
        f'---\n'
        f'Manage your subscriptions:\n{manage_url}\n'
    )
    secondary_actions = []
    if profile_url:
        secondary_actions.append({'label': 'Open public page', 'url': profile_url})
    send_email_async(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        eyebrow='Subscription',
        title=f'Updates enabled for {user_details.user.username}',
        greeting='there',
        intro=[f'You will receive status emails {pref_str} for this faculty member.'],
        facts=[('Faculty', user_details.user.username), ('Preference', pref_str.title())],
        action_label='Manage subscription',
        action_url=manage_url,
        secondary_actions=secondary_actions,
        footer_note='This magic link lets you manage public subscriptions and direct messages for this email address.',
    )

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
            action_url = dashboard_url_for_user(registered_user, tab='faculties')
            action_label = 'Open dashboard'
            footer_note = 'You received this because this email belongs to a registered Sir Kothay account.'
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
            action_url = manage_link_for_email(email, subscription=s)
            action_label = 'Manage subscription'
            footer_note = 'This magic link lets you manage public subscriptions and direct messages for this email address.'
            
        subject = "Subscription Settings Updated"
        pref_str = "All Updates" if preference == 'all' else "When Available" if preference == 'available' else "No Updates"
        body = f"Your notification subscription for {faculty_name} has been updated to: {pref_str}.\n\nThank you,\nSir Kothay Team"
        send_email_async(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            eyebrow='Subscription',
            title='Subscription settings updated',
            intro=[f'Your notification subscription for {faculty_name} has been updated.'],
            facts=[('Faculty', faculty_name), ('Preference', pref_str)],
            action_label=action_label,
            action_url=action_url,
            footer_note=footer_note,
        )
            
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
    registered_user = CustomUser.objects.filter(email=email).first()
    has_sub = StatusSubscription.objects.filter(email=email).exists()
    has_dm = DirectMessage.objects.filter(sender_email=email).exists()
    
    if not (registered_user or has_sub or has_dm):
        return Response({'error': 'No active subscriptions or messages found for this email.'}, status=status.HTTP_404_NOT_FOUND)

    token = Signer().sign(email)
    manage_link = manage_link_for_email(email, token=token)
    if registered_user:
        link = dashboard_url_for_user(registered_user)
        action_label = 'Open dashboard'
        footer_note = 'Use your Sir Kothay account to manage dashboard notifications.'
        body = (
            f'Open your Sir Kothay dashboard to manage notification subscriptions and direct messages:\n\n'
            f'{link}\n'
        )
        secondary_actions = []
        if has_sub or has_dm:
            secondary_actions.append({'label': 'Use magic manage link', 'url': manage_link})
            body += f'\nYou can also use this magic manage link for visitor subscriptions and direct messages:\n\n{manage_link}\n'
    else:
        link = manage_link
        action_label = 'Manage notifications'
        footer_note = 'This magic link acts like a password for this email address. Do not share it.'
        secondary_actions = []
        body = f"Click the link below to securely manage your notification subscriptions and direct messages:\n\n{link}\n\nThis link acts as your password, do not share it."
    
    subject = "Manage Your Sir Kothay Notifications"
    
    send_email_async(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        eyebrow='Manage notifications',
        title='Manage your notifications',
        intro=['Use the link below to manage notification subscriptions and direct messages connected to this email.'],
        action_label=action_label,
        action_url=link,
        secondary_actions=secondary_actions,
        footer_note=footer_note,
    )
    
    return Response({'status': 'ok'})
