from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CustomUser
from dashboard.models import StudentInterest
from notifications.models import StatusSubscription
from messaging.models import DirectMessage, ChatThread, ChatMessage

@receiver(post_save, sender=CustomUser)
def link_anonymous_records_to_new_user(sender, instance, created, **kwargs):
    """
    When a new user registers, find any anonymous StatusSubscriptions or DirectMessages
    associated with their email and migrate them to their authenticated account.
    """
    if created and instance.email:
        # Migrate StatusSubscription -> StudentInterest
        subs = StatusSubscription.objects.filter(email=instance.email)
        for sub in subs:
            interest, interest_created = StudentInterest.objects.get_or_create(
                student=instance,
                faculty=sub.broadcaster,
                defaults={'notify_preference': sub.notify_preference}
            )
            # If the interest already existed somehow, we don't overwrite its preference unless needed.
            # But normally this is a brand new user.
        subs.delete()

        # Migrate DirectMessage -> ChatThread + ChatMessage
        dms = DirectMessage.objects.filter(sender_email=instance.email)
        for dm in dms:
            # Create a ChatThread
            thread = ChatThread.objects.create(
                student=instance,
                faculty=dm.broadcaster,
                subject=dm.subject or 'No Subject',
                status='CLOSED' if dm.is_closed else 'PENDING',
                created_at=dm.created_at,
                last_activity_at=dm.created_at
            )
            
            # Create the initial message from the sender
            ChatMessage.objects.create(
                thread=thread,
                sender=instance,
                body=dm.body,
                created_at=dm.created_at
            )
            
            # If there was a reply from the faculty, add it as a message
            if dm.reply_body:
                ChatMessage.objects.create(
                    thread=thread,
                    sender=dm.broadcaster,
                    body=dm.reply_body,
                    created_at=dm.replied_at or dm.created_at
                )
                
        dms.delete()
