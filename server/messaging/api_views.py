from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings as django_settings

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from dashboard.models import UserDetails
from authApp.models import CustomUser

from .models import DirectMessage
from .models import DirectMessage, ChatThread, ChatMessage
from .serializers import (
    DirectMessageCreateSerializer,
    DirectMessageReplySerializer,
    DirectMessageSerializer,
)
from notifications.services import send_email_async


@api_view(['POST'])
@permission_classes([AllowAny])
def send_dm(request, user_slug):
    """Public endpoint — visitors send a direct message to a broadcaster."""
    user_details = get_object_or_404(UserDetails, _slug=user_slug)
    sender_email = request.data.get('sender_email')
    sender_name = request.data.get('sender_name')
    subject = request.data.get('subject', 'No Subject')
    body = request.data.get('body', '')

    # Intercept: If the sender email belongs to a registered student, route to ChatThread automatically
    registered_user = CustomUser.objects.filter(email=sender_email).first()
    if registered_user:
        thread = ChatThread.objects.create(
            student=registered_user,
            faculty=user_details.user,
            subject=subject,
            status='PENDING'
        )
        ChatMessage.objects.create(
            thread=thread,
            sender=registered_user,
            body=body
        )
        
        # Notify the faculty of the new ChatThread message
        faculty_email = user_details.user.email
        if faculty_email:
            fac_subject = f'New Chat Request from {registered_user.username}'
            fac_body = (
                f'Hi {user_details.user.username},\n\n'
                f'{registered_user.username} has started a new chat with you.\n\n'
                f'Subject: {subject}\n'
                f'Message:\n{body}\n\n'
                f'You can view and reply from your dashboard Inbox.\n'
            )
            send_email_async(fac_subject, fac_body, django_settings.DEFAULT_FROM_EMAIL, [faculty_email])

        return Response(
            {'message': 'Your message has been sent and added to your Dashboard Inbox.'},
            status=status.HTTP_201_CREATED,
        )

    # Standard anonymous flow
    serializer = DirectMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    dm = serializer.save(broadcaster=user_details.user)

    # Ensure a StatusSubscription exists to hold an unsubscribe token
    from notifications.models import StatusSubscription
    sub, _ = StatusSubscription.objects.get_or_create(
        email=dm.sender_email,
        broadcaster=user_details.user,
        defaults={'notify_preference': 'none', 'is_active': False}
    )

    client_base = getattr(django_settings, 'CLIENT_PUBLIC_BASE_URL', 'http://127.0.0.1:5500/client')
    if not client_base: client_base = 'http://127.0.0.1:5500/client'
    manage_url = f'{client_base}/broadcast/manage.html?token={sub.unsubscribe_token}'

    # Send confirmation email to the sender
    subject = f'Message sent to {user_details.user.username}'
    body = (
        f'Hi {dm.sender_name},\n\n'
        f'Your message to {user_details.user.username} has been successfully delivered.\n\n'
        f'Subject: {dm.subject or "No Subject"}\n'
        f'Message: {dm.body}\n\n'
        f'They will reply to you directly at this email address.\n\n'
        f'---\n'
        f'To manage your active messages or notifications, visit:\n{manage_url}\n'
    )
    send_email_async(subject, body, django_settings.DEFAULT_FROM_EMAIL, [dm.sender_email])

    # Send notification email to the faculty
    faculty_email = user_details.user.email
    if faculty_email:
        fac_subject = f'New Message from {dm.sender_name}'
        fac_body = (
            f'Hi {user_details.user.username},\n\n'
            f'You have received a new message from a visitor on your broadcast page.\n\n'
            f'From: {dm.sender_name} ({dm.sender_email})\n'
            f'Subject: {dm.subject or "No Subject"}\n'
            f'Message:\n{dm.body}\n\n'
            f'You can view and reply to this message from your Sir Kothay dashboard Inbox.\n'
        )
        send_email_async(fac_subject, fac_body, django_settings.DEFAULT_FROM_EMAIL, [faculty_email])

    return Response(
        {'message': 'Your message has been sent successfully.'},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inbox(request):
    """Authenticated — list all received DMs for the current user."""
    dms = DirectMessage.objects.filter(broadcaster=request.user)
    serializer = DirectMessageSerializer(dms, many=True)
    data = serializer.data
    # Annotate each DM with verified student info
    for item in data:
        email = item.get('sender_email', '')
        try:
            registered_user = CustomUser.objects.get(email=email)
            item['sender_is_registered'] = True
            item['sender_user_id'] = registered_user.id
            item['sender_role'] = registered_user.role
            item['sender_student_id'] = registered_user.student_id
        except CustomUser.DoesNotExist:
            item['sender_is_registered'] = False
            item['sender_user_id'] = None
            item['sender_role'] = None
            item['sender_student_id'] = None
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dm_detail(request, pk):
    """Authenticated — read a single DM and mark it as read."""
    dm = get_object_or_404(DirectMessage, pk=pk, broadcaster=request.user)
    if not dm.is_read:
        dm.is_read = True
        dm.save(update_fields=['is_read'])
    serializer = DirectMessageSerializer(dm)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_dm(request, pk):
    """Authenticated — reply to a DM (appends to conversation, sends email)."""
    dm = get_object_or_404(DirectMessage, pk=pk, broadcaster=request.user)
    if not dm.allows_replies:
        return Response(
            {'error': 'This user has opted out of receiving replies.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = DirectMessageReplySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    reply_text = serializer.validated_data['reply_body']
    now = timezone.now()

    # Append to existing replies (conversation thread)
    timestamp = now.strftime('%Y-%m-%d %H:%M')
    new_entry = f'[{timestamp}] {reply_text}'
    if dm.reply_body:
        dm.reply_body = dm.reply_body + '\n---REPLY_SEP---\n' + new_entry
    else:
        dm.reply_body = new_entry
    dm.replied_at = now
    dm.is_read = True
    dm.save(update_fields=['reply_body', 'replied_at', 'is_read'])

    from notifications.models import StatusSubscription
    sub = StatusSubscription.objects.filter(email=dm.sender_email).first()
    manage_text = ''
    if sub:
        client_base = getattr(django_settings, 'CLIENT_PUBLIC_BASE_URL', 'http://127.0.0.1:5500/client')
        if not client_base: client_base = 'http://127.0.0.1:5500/client'
        manage_url = f'{client_base}/broadcast/manage.html?token={sub.unsubscribe_token}'
        manage_text = f'\n---\nTo manage your active messages or opt out of replies, visit:\n{manage_url}\n'

    from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    subject = f'Reply from {request.user.username} — Sir Kothay'
    body = (
        f'Hi {dm.sender_name},\n\n'
        f'{request.user.username} replied to your message:\n\n'
        f'--- Your message ---\n{dm.body}\n\n'
        f'--- Reply ---\n{reply_text}\n\n'
        f'— Sir Kothay\n'
        f'{manage_text}'
    )
    send_mail(subject, body, from_email, [dm.sender_email], fail_silently=True)

    return Response({'message': 'Reply sent successfully.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_dm(request, pk):
    """Authenticated — delete a received DM."""
    dm = get_object_or_404(DirectMessage, pk=pk, broadcaster=request.user)
    dm.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    """Authenticated — return the count of unread DMs."""
    count = DirectMessage.objects.filter(broadcaster=request.user, is_read=False).count()
    return Response({'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_dm(request, pk):
    """Authenticated — close a DM so it no longer appears in active inbox."""
    dm = get_object_or_404(DirectMessage, pk=pk, broadcaster=request.user)
    dm.is_closed = True
    dm.is_read = True
    dm.save(update_fields=['is_closed', 'is_read'])
    return Response({'message': 'DM closed.'})
