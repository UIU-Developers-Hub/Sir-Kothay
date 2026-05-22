from rest_framework import serializers

from .models import RecurringSchedule, CalendarEvent, QuickStatusTemplate, PageView


class RecurringScheduleSerializer(serializers.ModelSerializer):
    day_label = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = RecurringSchedule
        fields = [
            'id', 'message', 'day_of_week', 'day_label', 'time_of_day',
            'duration_seconds', 'is_active', 'set_availability', 'last_triggered_at',
        ]
        read_only_fields = ['id', 'last_triggered_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'start_time', 'end_time',
            'color', 'set_availability', 'all_day', 'recurrence_rule', 'is_active',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, attrs):
        start = attrs.get('start_time') or (self.instance and self.instance.start_time)
        end = attrs.get('end_time') or (self.instance and self.instance.end_time)
        if start and end and end <= start:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
        return attrs


class QuickStatusTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickStatusTemplate
        fields = ['id', 'label', 'message', 'icon', 'set_availability', 'sort_order']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class PageViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageView
        fields = ['date', 'view_count', 'qr_scan_count']
