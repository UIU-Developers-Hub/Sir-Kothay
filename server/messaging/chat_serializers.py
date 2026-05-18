from rest_framework import serializers

from authApp.models import CustomUser
from dashboard.models import UserDetails
from .models import ChatThread, ChatMessage


class ChatUserSerializer(serializers.ModelSerializer):
    """Minimal user info for chat participants."""
    profile_image_url = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'student_id', 'profile_image_url', 'designation', 'slug']
        read_only_fields = fields

    def get_profile_image_url(self, obj):
        try:
            return obj.details.get_image_url
        except UserDetails.DoesNotExist:
            return None

    def get_designation(self, obj):
        try:
            return obj.details.designation
        except UserDetails.DoesNotExist:
            return ''

    def get_slug(self, obj):
        try:
            return obj.details.slug
        except UserDetails.DoesNotExist:
            return ''


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'thread', 'sender', 'sender_name', 'sender_role', 'body', 'created_at']
        read_only_fields = ['id', 'thread', 'sender', 'sender_name', 'sender_role', 'created_at']


class ChatThreadListSerializer(serializers.ModelSerializer):
    """Thread list with last message preview."""
    student_info = ChatUserSerializer(source='student', read_only=True)
    faculty_info = ChatUserSerializer(source='faculty', read_only=True)
    last_message = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, default=None)

    class Meta:
        model = ChatThread
        fields = [
            'id', 'student_info', 'faculty_info', 'subject', 'status',
            'accepted_at', 'closed_at', 'closed_by_name',
            'last_activity_at', 'created_at',
            'last_message', 'message_count',
        ]

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {
                'body': msg.body[:100],
                'sender_name': msg.sender.username,
                'created_at': msg.created_at.isoformat(),
            }
        return None

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatThreadDetailSerializer(ChatThreadListSerializer):
    """Full thread with all messages."""
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta(ChatThreadListSerializer.Meta):
        fields = ChatThreadListSerializer.Meta.fields + ['messages']


class ChatInitiateSerializer(serializers.Serializer):
    """Validate subject + body for creating a new thread."""
    faculty_id = serializers.IntegerField()
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()

    def validate_faculty_id(self, value):
        try:
            user = CustomUser.objects.get(pk=value, role='FACULTY')
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Faculty not found.')
        return value


class ChatReplySerializer(serializers.Serializer):
    """Validate reply body."""
    body = serializers.CharField()
