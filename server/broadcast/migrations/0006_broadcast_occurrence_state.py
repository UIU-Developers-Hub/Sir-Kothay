from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone


def mark_existing_active_messages(apps, schema_editor):
    BroadcastMessage = apps.get_model('broadcast', 'BroadcastMessage')
    timed_messages = BroadcastMessage.objects.filter(
        started_at__isnull=True,
        active_until__isnull=False,
        duration_seconds__isnull=False,
    )
    for message in timed_messages.iterator():
        message.started_at = message.active_until - timedelta(seconds=message.duration_seconds)
        message.save(update_fields=['started_at'])
    BroadcastMessage.objects.filter(active=True, started_at__isnull=True).update(started_at=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ('broadcast', '0005_rename_duration_minutes_broadcastmessage_duration_seconds'),
    ]

    operations = [
        migrations.AddField(
            model_name='broadcastmessage',
            name='manually_stopped',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='broadcastmessage',
            name='occurrence_key',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='broadcastmessage',
            name='source_id',
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='broadcastmessage',
            name='source_type',
            field=models.CharField(
                choices=[('manual', 'Manual'), ('recurring', 'Recurring schedule'), ('calendar', 'Calendar event')],
                default='manual',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='broadcastmessage',
            name='started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(mark_existing_active_messages, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name='broadcastmessage',
            index=models.Index(fields=['user', 'active'], name='broadcast_u_active_idx'),
        ),
        migrations.AddIndex(
            model_name='broadcastmessage',
            index=models.Index(fields=['source_type', 'source_id', 'occurrence_key'], name='broadcast_source_occ_idx'),
        ),
        migrations.AddConstraint(
            model_name='broadcastmessage',
            constraint=models.UniqueConstraint(
                condition=models.Q(('source_id__isnull', False)),
                fields=('source_type', 'source_id', 'occurrence_key'),
                name='unique_schedule_occurrence',
            ),
        ),
    ]
