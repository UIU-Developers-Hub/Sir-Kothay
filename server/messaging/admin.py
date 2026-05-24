from django.contrib import admin

from .models import DirectMessage, ChatThread, ChatMessage


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ('sender_name', 'sender_email', 'broadcaster', 'is_read', 'is_closed', 'created_at')
    list_filter = ('is_read', 'is_closed', 'created_at')
    search_fields = ('sender_name', 'sender_email', 'subject', 'body')
    readonly_fields = ('created_at',)


@admin.register(ChatThread)
class ChatThreadAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'faculty', 'subject', 'status', 'last_activity_at', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('subject', 'student__username', 'faculty__username')
    readonly_fields = ('created_at', 'last_activity_at')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'thread', 'sender', 'body_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('body', 'sender__username')
    readonly_fields = ('created_at',)

    def body_preview(self, obj):
        return obj.body[:80]
    body_preview.short_description = 'Message'
