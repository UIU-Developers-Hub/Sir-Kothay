from rest_framework import serializers

from .models import StatusSubscription


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class StatusSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusSubscription
        fields = ['id', 'email', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
