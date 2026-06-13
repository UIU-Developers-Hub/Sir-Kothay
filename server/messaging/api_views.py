from django.shortcuts import get_object_or_404
from django.utils import timezone
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
from notifications.services import (
    chat_thread_url,
    dashboard_url_for_user,
    manage_link_for_email,
    public_broadcast_url,
    send_email_async,
)


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
            thread_link = chat_thread_url(user_details.user, thread.id)
            fac_subject = f'New Chat Request from {registered_user.username}'
            fac_body = (
                f'Hi {user_details.user.username},\n\n'
                f'{registered_user.username} has started a new chat with you.\n\n'
                f'Subject: {subject}\n'
                f'Message:\n{body}\n\n'
                f'You can view and reply from your dashboard Inbox:\n{thread_link}\n'
            )
            send_email_async(
                fac_subject,
                fac_body,
                django_settings.DEFAULT_FROM_EMAIL,
                [faculty_email],
                eyebrow='New chat request',
                title='New chat request',
                greeting=user_details.user.username,
                intro=[f'{registered_user.username} has started a new chat with you.'],
                facts=[
                    ('Student', registered_user.username),
                    ('Student ID', registered_user.student_id or 'N/A'),
                    ('Subject', subject),
                ],
                quote_label='Message',
                quote=body,
                action_label='Open chat request',
                action_url=thread_link,
                footer_note='You received this because new chat email notifications are enabled for your account.',
            )

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

    manage_url = manage_link_for_email(dm.sender_email, subscription=sub)
    profile_url = public_broadcast_url(user_details.user)

    # Send confirmation email to the sender
    subject = f'Message sent to {user_details.user.username}'
    body = (
        f'Hi {dm.sender_name},\n\n'
        f'Your message to {user_details.user.username} has been successfully delivered.\n\n'
        f'Subject: {dm.subject or "No Subject"}\n'
        f'Message: {dm.body}\n\n'
        f'They will reply to you directly at this email address.\n\n'
        f'---\n'
        f'Manage your subscriptions:\n{manage_url}\n'
    )
    secondary_actions = []
    if profile_url:
        secondary_actions.append({'label': 'Open faculty page', 'url': profile_url})
    send_email_async(
        subject,
        body,
        django_settings.DEFAULT_FROM_EMAIL,
        [dm.sender_email],
        eyebrow='Message delivered',
        title=f'Message sent to {user_details.user.username}',
        greeting=dm.sender_name,
        intro=['Your message has been successfully delivered.'],
        facts=[('Faculty', user_details.user.username), ('Subject', dm.subject or 'No Subject')],
        quote_label='Your message',
        quote=dm.body,
        action_label='Manage messages',
        action_url=manage_url,
        secondary_actions=secondary_actions,
        footer_note='This magic link lets you manage public subscriptions and direct messages for this email address.',
    )

    # Send notification email to the faculty
    faculty_email = user_details.user.email
    if faculty_email:
        inbox_url = dashboard_url_for_user(user_details.user, tab='inbox')
        fac_subject = f'New Message from {dm.sender_name}'
        fac_body = (
            f'Hi {user_details.user.username},\n\n'
            f'You have received a new message from a visitor on your broadcast page.\n\n'
            f'From: {dm.sender_name} ({dm.sender_email})\n'
            f'Subject: {dm.subject or "No Subject"}\n'
            f'Message:\n{dm.body}\n\n'
            f'You can view and reply to this message from your Sir Kothay dashboard Inbox:\n{inbox_url}\n'
        )
        send_email_async(
            fac_subject,
            fac_body,
            django_settings.DEFAULT_FROM_EMAIL,
            [faculty_email],
            eyebrow='New direct message',
            title='New visitor message',
            greeting=user_details.user.username,
            intro=['You received a new message from your public broadcast page.'],
            facts=[
                ('From', f'{dm.sender_name} ({dm.sender_email})'),
                ('Subject', dm.subject or 'No Subject'),
            ],
            quote_label='Message',
            quote=dm.body,
            action_label='Open inbox',
            action_url=inbox_url,
            footer_note='You received this because this message was sent to your Sir Kothay public page.',
        )

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
    manage_url = manage_link_for_email(dm.sender_email, subscription=sub)
    registered_sender = CustomUser.objects.filter(email=dm.sender_email).first()
    secondary_actions = []
    if registered_sender:
        secondary_actions.append({'label': 'Open dashboard', 'url': dashboard_url_for_user(registered_sender)})

    from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    subject = f'Reply from {request.user.username} — Sir Kothay'
    body = (
        f'Hi {dm.sender_name},\n\n'
        f'{request.user.username} replied to your message:\n\n'
        f'--- Your message ---\n{dm.body}\n\n'
        f'--- Reply ---\n{reply_text}\n\n'
        f'Manage this conversation:\n{manage_url}\n\n'
        f'— Sir Kothay'
    )
    send_email_async(
        subject,
        body,
        from_email,
        [dm.sender_email],
        fail_silently=True,
        eyebrow='Direct message reply',
        title=f'Reply from {request.user.username}',
        greeting=dm.sender_name,
        intro=[f'{request.user.username} replied to your message.'],
        facts=[('Original subject', dm.subject or 'No Subject')],
        sections=[
            {'title': 'Your message', 'body': dm.body},
            {'title': 'Reply', 'body': reply_text},
        ],
        action_label='Manage this conversation',
        action_url=manage_url,
        secondary_actions=secondary_actions,
        footer_note='This magic link lets you manage public subscriptions and direct messages for this email address.',
    )

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
