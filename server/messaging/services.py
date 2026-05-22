from datetime import timedelta
from django.utils import timezone
from messaging.models import ChatThread
from dashboard.models import UserDetails

def _format_seconds(secs):
    if secs % 31536000 == 0: return f"{secs // 31536000} year(s)"
    if secs % 2592000 == 0: return f"{secs // 2592000} month(s)"
    if secs % 86400 == 0: return f"{secs // 86400} day(s)"
    if secs % 3600 == 0: return f"{secs // 3600} hour(s)"
    if secs % 60 == 0: return f"{secs // 60} minute(s)"
    return f"{secs} second(s)"

def process_stale_chats():
    now = timezone.now()
    closed_count = 0
    target_threads = ChatThread.objects.filter(status__in=['ACTIVE', 'CLOSED'])

    for thread in target_threads:
        try:
            faculty_details = UserDetails.objects.get(user=thread.faculty)
            seconds = faculty_details.auto_close_seconds
            if seconds is None:
                continue

            cutoff = now - timedelta(seconds=seconds)
            if thread.last_activity_at < cutoff:
                will_delete = getattr(faculty_details, 'auto_delete_closed_chats', False)
                
                if thread.status == 'CLOSED':
                    if will_delete and not thread.deleted_by_faculty:
                        thread.deleted_by_faculty = True
                        thread.save(update_fields=['deleted_by_faculty'])
                        if thread.deleted_by_student and thread.deleted_by_faculty:
                            thread.delete()
                    continue

                # It is ACTIVE, so close it
                thread_subject = thread.subject
                
                # It should close for both sides
                thread.status = 'CLOSED'
                thread.closed_at = now
                thread.closed_by = None
                
                # If faculty wants it deleted, only delete from their side
                if will_delete:
                    thread.deleted_by_faculty = True
                    
                thread.save()
                
                if thread.deleted_by_student and thread.deleted_by_faculty:
                    thread.delete()
                
                closed_count += 1

                from messaging.chat_views import _send_chat_email, _should_notify, _get_client_base
                client_base = _get_client_base()
                for participant in [thread.student, thread.faculty]:
                    if _should_notify(participant, 'notify_chat_closed'):
                        link = f'{client_base}/dashboard/student.html?tab=messages&thread={thread.id}' if participant.role == 'STUDENT' else f'{client_base}/dashboard/home.html?tab=chats&thread={thread.id}'
                        action_text = "permanently deleted" if will_delete else "closed"
                        link_text = "" if will_delete else f'\nView the thread: {link}\n'
                        time_str = _format_seconds(seconds)
                        body = (
                            f'Hi {participant.username},\n\n'
                            f'Your chat thread "{thread_subject}" was automatically {action_text} '
                            f'due to {time_str} of inactivity.\n{link_text}\n'
                            f'— Sir Kothay'
                        )
                        _send_chat_email(
                            participant.email,
                            f'Chat Auto-{action_text.title()}: {thread_subject} — Sir Kothay',
                            body,
                        )
        except UserDetails.DoesNotExist:
            continue
    return closed_count
