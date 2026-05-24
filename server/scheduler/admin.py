from django.contrib import admin

from .models import CalendarEvent, PageView, QuickStatusTemplate, RecurringSchedule


@admin.register(RecurringSchedule)
class RecurringScheduleAdmin(admin.ModelAdmin):
    list_display = ('user', 'day_of_week', 'time_of_day', 'is_active')
    list_filter = ('is_active', 'day_of_week')


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'start_time', 'end_time', 'recurrence_rule')
    list_filter = ('recurrence_rule',)


@admin.register(QuickStatusTemplate)
class QuickStatusTemplateAdmin(admin.ModelAdmin):
    list_display = ('user', 'label', 'sort_order')


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ('broadcaster', 'date', 'view_count', 'qr_scan_count')
    list_filter = ('date',)
