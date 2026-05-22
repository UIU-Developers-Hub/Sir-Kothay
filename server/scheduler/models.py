from django.conf import settings
from django.db import models


class RecurringSchedule(models.Model):
    """Automatically activate a broadcast message on a recurring day/time pattern."""
    DAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recurring_schedules',
    )
    message = models.TextField()
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    time_of_day = models.TimeField()
    duration_seconds = models.PositiveIntegerField(
        blank=True, null=True,
        help_text='How long the status stays active. Null = until next change.',
    )
    is_active = models.BooleanField(default=True)
    set_availability = models.CharField(
        max_length=10, blank=True, default='',
        help_text='When triggered: "true"=Available, "false"=Unavailable, ""=no change.',
    )
    last_triggered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['day_of_week', 'time_of_day']

    def __str__(self):
        return f'{self.get_day_of_week_display()} {self.time_of_day} — {self.message[:30]}'


class CalendarEvent(models.Model):
    """An internal calendar/planner event that optionally syncs to broadcast status."""
    RECURRENCE_CHOICES = [
        ('none', 'None'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='calendar_events',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    color = models.CharField(max_length=20, blank=True, default='#f68b1f')
    set_availability = models.CharField(
        max_length=10, blank=True, default='',
        help_text='"true"=Available, "false"=Unavailable, ""=no change.',
    )
    is_active = models.BooleanField(default=True)
    all_day = models.BooleanField(default=False)
    recurrence_rule = models.CharField(
        max_length=10, choices=RECURRENCE_CHOICES, default='none',
    )

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f'{self.title} ({self.start_time:%Y-%m-%d %H:%M})'


class QuickStatusTemplate(models.Model):
    """One-click status template for rapid broadcast updates."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='quick_templates',
    )
    label = models.CharField(max_length=100)
    message = models.TextField()
    icon = models.CharField(max_length=50, blank=True, default='bi-lightning-fill')
    set_availability = models.CharField(
        max_length=10, blank=True, default='',
        help_text='When activated: "true"=Available, "false"=Unavailable, ""=no change.',
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.label


class PageView(models.Model):
    """Daily aggregate counter for broadcaster page visits and QR scans."""
    broadcaster = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='page_views',
    )
    date = models.DateField()
    view_count = models.PositiveIntegerField(default=0)
    qr_scan_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('broadcaster', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f'{self.broadcaster.username} — {self.date} — {self.view_count} views'
