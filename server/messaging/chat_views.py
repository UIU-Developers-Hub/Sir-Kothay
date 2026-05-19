from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authApp.models import CustomUser
from dashboard.models import UserDetails

from .models import ChatThread, ChatMessage
from .chat_serializers import (
    ChatThreadListSerializer,
    ChatThreadDetailSerializer,
    ChatInitiateSerializer,
    ChatReplySerializer,
)


def _get_client_base():
    """Return the client base URL for email links."""
    return getattr(django_settings, 'CLIENT_PUBLIC_BASE_URL', '').rstrip('/')


import threading

def _send_chat_email_worker(subject, body, from_email, to_email):
    """Worker running in a background thread to send chat-related emails without blocking the request thread."""
    try:
        send_mail(subject, body, from_email, [to_email], fail_silently=False)
    except Exception as e:
        print(f"Background chat email delivery failed to {to_email}: {e}")

def _send_chat_email(to_email, subject, body):
    """Helper to send a chat-related email asynchronously in the background."""
    from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com')
    t = threading.Thread(
        target=_send_chat_email_worker,
        args=(subject, body, from_email, to_email)
    )
    t.daemon = True
    t.start()


def _should_notify(user, setting_name):
    """Check if a user has a notification setting enabled."""
    try:
        details = user.details
        return getattr(details, setting_name, False)
    except UserDetails.DoesNotExist:
        return False


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_chat(request):
    """Student initiates a new chat thread with a faculty member."""
    if request.user.role != 'STUDENT':
        return Response({'error': 'Only students can initiate chats.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ChatInitiateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    faculty_id = serializer.validated_data['faculty_id']
    subject = serializer.validated_data['subject']
    body = serializer.validated_data['body']

    faculty = get_object_or_404(CustomUser, pk=faculty_id, role='FACULTY')

    # Check for existing open thread
    existing = ChatThread.objects.filter(
        student=request.user, faculty=faculty
    ).exclude(status='CLOSED').first()
    if existing:
        return Response(
            {'error': 'You already have an open chat with this faculty.', 'thread_id': existing.id},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create thread
    thread = ChatThread.objects.create(
        student=request.user,
        faculty=faculty,
        subject=subject,
    )

    # Create first message
    ChatMessage.objects.create(
        thread=thread,
        sender=request.user,
        body=body,
    )

    # Email faculty if setting enabled
    if _should_notify(faculty, 'notify_new_chats'):
        client_base = _get_client_base()
        thread_link = f'{client_base}/dashboard/home.html?tab=chats&thread={thread.id}'
        student_id = request.user.student_id or 'N/A'
        email_body = (
            f'Hi {faculty.username},\n\n'
            f'{request.user.username} (Student ID: {student_id}) started a new chat with you.\n\n'
            f'Subject: {subject}\n'
            f'Message: {body}\n\n'
            f'View the thread: {thread_link}\n\n'
            f'— Sir Kothay'
        )
        _send_chat_email(faculty.email, f'New Chat: {subject} — Sir Kothay', email_body)

    result = ChatThreadDetailSerializer(thread).data
    return Response(result, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_threads(request):
    """List all chat threads for the current user (excluding soft-deleted)."""
    if request.user.role == 'STUDENT':
        threads = ChatThread.objects.filter(student=request.user, deleted_by_student=False)
    elif request.user.role == 'FACULTY':
        threads = ChatThread.objects.filter(faculty=request.user, deleted_by_faculty=False)
    else:
        threads = (
            ChatThread.objects.filter(student=request.user, deleted_by_student=False) |
            ChatThread.objects.filter(faculty=request.user, deleted_by_faculty=False)
        )

    status_filter = request.query_params.get('status')
    if status_filter:
        threads = threads.filter(status=status_filter.upper())

    serializer = ChatThreadListSerializer(threads, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def thread_detail(request, pk):
    """Get a thread with all messages."""
    thread = get_object_or_404(ChatThread, pk=pk)

    # Only participants can view
    if request.user != thread.student and request.user != thread.faculty:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ChatThreadDetailSerializer(thread)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_thread(request, pk):
    """Faculty accepts a pending thread."""
    thread = get_object_or_404(ChatThread, pk=pk, faculty=request.user)

    if thread.status != 'PENDING':
        return Response({'error': 'Thread is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

    thread.status = 'ACTIVE'
    thread.accepted_at = timezone.now()
    thread.save(update_fields=['status', 'accepted_at'])

    # Email student if setting enabled
    if _should_notify(thread.student, 'notify_new_chats'):
        client_base = _get_client_base()
        thread_link = f'{client_base}/dashboard/student.html?tab=messages&thread={thread.id}'
        email_body = (
            f'Hi {thread.student.username},\n\n'
            f'{thread.faculty.username} accepted your chat request.\n\n'
            f'Subject: {thread.subject}\n'
            f'You can now continue the conversation.\n\n'
            f'View the thread: {thread_link}\n\n'
            f'— Sir Kothay'
        )
        _send_chat_email(thread.student.email, f'Chat Accepted: {thread.subject} — Sir Kothay', email_body)

    return Response({'message': 'Thread accepted.', 'status': 'ACTIVE'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_thread(request, pk):
    """Send a message in an active thread. Students can also message pending threads."""
    thread = get_object_or_404(ChatThread, pk=pk)

    # Only participants can reply
    if request.user != thread.student and request.user != thread.faculty:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    if thread.status == 'CLOSED':
        return Response({'error': 'This thread is closed. No more messages can be sent.'}, status=status.HTTP_400_BAD_REQUEST)

    # Faculty can only reply if thread is ACTIVE
    if request.user == thread.faculty and thread.status != 'ACTIVE':
        return Response({'error': 'You must accept this thread before replying.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ChatReplySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    body = serializer.validated_data['body']

    msg = ChatMessage.objects.create(
        thread=thread,
        sender=request.user,
        body=body,
    )

    thread.last_activity_at = timezone.now()
    thread.save(update_fields=['last_activity_at'])

    # Email the other party if their setting is enabled
    other = thread.faculty if request.user == thread.student else thread.student
    if _should_notify(other, 'notify_chat_replies'):
        client_base = _get_client_base()
        if other.role == 'STUDENT':
            thread_link = f'{client_base}/dashboard/student.html?tab=messages&thread={thread.id}'
        else:
            thread_link = f'{client_base}/dashboard/home.html?tab=chats&thread={thread.id}'
        email_body = (
            f'Hi {other.username},\n\n'
            f'{request.user.username} sent a new message in your chat.\n\n'
            f'Subject: {thread.subject}\n'
            f'Message: {body}\n\n'
            f'View the thread: {thread_link}\n\n'
            f'— Sir Kothay'
        )
        _send_chat_email(other.email, f'New Reply: {thread.subject} — Sir Kothay', email_body)

    return Response(ChatThreadDetailSerializer(thread).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_thread(request, pk):
    """Close a thread. Either party can close."""
    thread = get_object_or_404(ChatThread, pk=pk)

    if request.user != thread.student and request.user != thread.faculty:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    if thread.status == 'CLOSED':
        return Response({'error': 'Thread is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

    thread.status = 'CLOSED'
    thread.closed_at = timezone.now()
    thread.closed_by = request.user
    thread.save(update_fields=['status', 'closed_at', 'closed_by'])

    # Email both parties about closure (based on their settings)
    client_base = _get_client_base()
    for participant in [thread.student, thread.faculty]:
        if participant == request.user:
            continue  # Don't email the person who closed it
        if _should_notify(participant, 'notify_chat_closed'):
            if participant.role == 'STUDENT':
                thread_link = f'{client_base}/dashboard/student.html?tab=messages&thread={thread.id}'
            else:
                thread_link = f'{client_base}/dashboard/home.html?tab=chats&thread={thread.id}'
            email_body = (
                f'Hi {participant.username},\n\n'
                f'{request.user.username} has closed the chat thread.\n\n'
                f'Subject: {thread.subject}\n'
                f'No further messages can be sent in this thread.\n\n'
                f'View the thread: {thread_link}\n\n'
                f'— Sir Kothay'
            )
            _send_chat_email(participant.email, f'Chat Closed: {thread.subject} — Sir Kothay', email_body)

    return Response({'message': 'Thread closed.', 'status': 'CLOSED'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_thread(request, faculty_id):
    """Check if the current student has an open thread with a faculty member."""
    if request.user.role != 'STUDENT':
        return Response({'has_thread': False, 'thread_id': None})

    thread = ChatThread.objects.filter(
        student=request.user, faculty_id=faculty_id
    ).exclude(status='CLOSED').first()

    if thread:
        return Response({'has_thread': True, 'thread_id': thread.id, 'status': thread.status})
    return Response({'has_thread': False, 'thread_id': None})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_thread(request, pk):
    """Soft-delete a thread for the requesting user. Closes if still open."""
    thread = get_object_or_404(ChatThread, pk=pk)

    if request.user != thread.student and request.user != thread.faculty:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    # Close first if still open
    if thread.status != 'CLOSED':
        thread.status = 'CLOSED'
        thread.closed_at = timezone.now()
        thread.closed_by = request.user

    # Set soft-delete flag for the requesting side
    if request.user == thread.student:
        thread.deleted_by_student = True
    else:
        thread.deleted_by_faculty = True

    thread.save()

    # Hard-delete if both sides have deleted
    if thread.deleted_by_student and thread.deleted_by_faculty:
        thread.delete()

    return Response({'message': 'Thread deleted.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_and_delete_all(request):
    """Close all open threads then soft-delete ALL threads for the current user."""
    if request.user.role == 'STUDENT':
        threads = ChatThread.objects.filter(student=request.user, deleted_by_student=False)
        delete_field = 'deleted_by_student'
    elif request.user.role == 'FACULTY':
        threads = ChatThread.objects.filter(faculty=request.user, deleted_by_faculty=False)
        delete_field = 'deleted_by_faculty'
    else:
        return Response({'message': '0 thread(s) deleted.', 'count': 0})

    # Close open threads first
    threads.exclude(status='CLOSED').update(
        status='CLOSED', closed_at=timezone.now(), closed_by=request.user
    )

    count = threads.count()
    # Soft-delete for this user
    threads.update(**{delete_field: True})

    # Hard-delete any where both sides deleted
    ChatThread.objects.filter(deleted_by_student=True, deleted_by_faculty=True).delete()

    return Response({'message': f'{count} thread(s) deleted.', 'count': count})
