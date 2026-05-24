from rest_framework import serializers
from django.utils import timezone
from .models import BroadcastMessage


class BroadcastMessageSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
    duration_seconds = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    active_until = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = BroadcastMessage
        fields = [
            'id', 'user', 'user_email', 'user_username', 'message', 'active',
            'scheduled_for', 'duration_seconds', 'active_until', 'set_availability'
        ]
        read_only_fields = ['id', 'user']

    def validate(self, attrs):
        scheduled_for = attrs.get('scheduled_for')
        if scheduled_for and scheduled_for > timezone.now():
            # Future schedule means this message should not be active yet.
            attrs['active'] = False
        return attrs
    
    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)
