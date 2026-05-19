from rest_framework import serializers
from .models import UserDetails, StudentInterest
from authApp.models import CustomUser


class UserDetailsSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    profile_image_url = serializers.SerializerMethodField()
    slug = serializers.CharField(read_only=True)
    username = serializers.CharField(
        max_length=150, write_only=True, required=False, help_text='Display name (any characters).'
    )
    email = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = UserDetails
        fields = [
            'id', 'user', 'user_email', 'user_username', 'username', 'email',
            'profile_image', 'profile_image_url', 'phone_number', 'bio', 'designation',
            'organization', 'default_status', 'default_availability', 'is_available', 'slug',
            'notify_new_chats', 'notify_chat_replies', 'notify_chat_closed', 'auto_close_hours',
        ]
        read_only_fields = ['id', 'user', 'slug']

    def update(self, instance, validated_data):
        new_username = validated_data.pop('username', None)
        new_email = validated_data.pop('email', None)
        user = instance.user
        changed = False
        if new_username is not None:
            user.username = new_username
            changed = True
        if new_email is not None:
            user.email = new_email
            changed = True
        if changed:
            user.save()
        return super().update(instance, validated_data)

    def get_profile_image_url(self, obj):
        return obj.get_image_url

class StudentInterestSerializer(serializers.ModelSerializer):
    faculty_username = serializers.CharField(source='faculty.username', read_only=True)
    faculty_details = serializers.SerializerMethodField()
    student = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = StudentInterest
        fields = ['id', 'student', 'faculty', 'faculty_username', 'faculty_details', 'notify_preference', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_faculty_details(self, obj):
        try:
            details = UserDetails.objects.get(user=obj.faculty)
            return UserDetailsSerializer(details).data
        except UserDetails.DoesNotExist:
            return None

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'student_id', 'is_active', 'is_staff', 'is_banned', 'date_joined']

