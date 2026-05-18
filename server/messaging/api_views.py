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
from .serializers import (
    DirectMessageCreateSerializer,
    DirectMessageReplySerializer,
    DirectMessageSerializer,
)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_dm(request, user_slug):
    """Public endpoint — visitors send a direct message to a broadcaster."""
    user_details = get_object_or_404(UserDetails, _slug=user_slug)
    serializer = DirectMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(broadcaster=user_details.user)
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

    from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    subject = f'Reply from {request.user.username} — Sir Kothay'
    body = (
        f'Hi {dm.sender_name},\n\n'
        f'{request.user.username} replied to your message:\n\n'
        f'--- Your message ---\n{dm.body}\n\n'
        f'--- Reply ---\n{reply_text}\n\n'
        f'— Sir Kothay\n'
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
