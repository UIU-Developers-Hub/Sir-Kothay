from django.contrib import admin

from .models import DirectMessage


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ('sender_name', 'sender_email', 'broadcaster', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at')
    search_fields = ('sender_name', 'sender_email', 'subject', 'body')
    readonly_fields = ('created_at',)
