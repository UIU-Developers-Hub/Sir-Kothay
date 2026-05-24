from rest_framework import serializers

from .models import StatusSubscription


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    notify_preference = serializers.ChoiceField(
        choices=[('available', 'When Available'), ('all', 'All Updates')],
        required=False,
        default='available'
    )

class StatusSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusSubscription
        fields = ['id', 'email', 'is_active', 'notify_preference', 'created_at']
        read_only_fields = ['id', 'created_at']
