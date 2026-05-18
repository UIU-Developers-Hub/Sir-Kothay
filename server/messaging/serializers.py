from rest_framework import serializers

from .models import DirectMessage


class DirectMessageCreateSerializer(serializers.ModelSerializer):
    """Public-facing serializer — visitors create a DM without authentication."""

    class Meta:
        model = DirectMessage
        fields = ['id', 'sender_name', 'sender_email', 'subject', 'body', 'created_at']
        read_only_fields = ['id', 'created_at']


class DirectMessageSerializer(serializers.ModelSerializer):
    """Full serializer for the broadcaster's inbox view (read + reply)."""

    class Meta:
        model = DirectMessage
        fields = [
            'id', 'sender_name', 'sender_email', 'subject', 'body',
            'is_read', 'reply_body', 'replied_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'sender_name', 'sender_email', 'subject', 'body',
            'created_at',
        ]


class DirectMessageReplySerializer(serializers.Serializer):
    reply_body = serializers.CharField()
