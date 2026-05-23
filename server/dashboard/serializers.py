from rest_framework import serializers
from .models import UserDetails, StudentInterest
from authApp.models import CustomUser


class UserDetailsSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_student_id = serializers.CharField(source='user.student_id', read_only=True)
    profile_image_url = serializers.SerializerMethodField()
    active_message = serializers.SerializerMethodField()
    qr_code_url = serializers.SerializerMethodField()
    slug = serializers.CharField(read_only=True)
    username = serializers.CharField(
        max_length=150, write_only=True, required=False, help_text='Display name (any characters).'
    )
    email = serializers.EmailField(write_only=True, required=False)
    student_id = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = UserDetails
        fields = [
            'id', 'user', 'user_email', 'user_username', 'user_student_id', 'username', 'email', 'student_id',
            'profile_image', 'profile_image_url', 'phone_number', 'bio', 'designation',
            'organization', 'default_status', 'default_availability', 'is_available', 'slug',
            'active_message', 'qr_code_url',
            'notify_new_chats', 'notify_chat_replies', 'notify_chat_closed', 'auto_close_seconds', 'auto_delete_closed_chats',
        ]
        read_only_fields = ['id', 'user', 'slug']

    def update(self, instance, validated_data):
        from django.db import IntegrityError
        new_username = validated_data.pop('username', None)
        new_email = validated_data.pop('email', None)
        new_student_id = validated_data.pop('student_id', None)
        user = instance.user
        changed = False
        if new_username is not None:
            user.username = new_username
            changed = True
        if new_email is not None:
            user.email = new_email
            changed = True
        if new_student_id is not None:
            if new_student_id == '':
                user.student_id = None
            else:
                user.student_id = new_student_id
            changed = True
            
        if changed:
            try:
                user.save()
            except IntegrityError as e:
                error_msg = str(e).lower()
                if 'student_id' in error_msg:
                    raise serializers.ValidationError({'student_id': 'This Student ID is already taken.'})
                elif 'email' in error_msg:
                    raise serializers.ValidationError({'email': 'This Email is already taken.'})
                elif 'username' in error_msg:
                    raise serializers.ValidationError({'username': 'This Username is already taken.'})
                else:
                    raise serializers.ValidationError({'error': 'A conflict occurred updating user data.'})
                    
        return super().update(instance, validated_data)

    def get_profile_image_url(self, obj):
        return obj.get_image_url

    def get_active_message(self, obj):
        try:
            from broadcast.models import BroadcastMessage
            BroadcastMessage.activate_due_messages(user=obj.user)
            active = BroadcastMessage.objects.filter(user=obj.user, active=True).order_by('-id').first()
            return active.message if active else None
        except Exception:
            return None

    def get_qr_code_url(self, obj):
        try:
            qr_code = getattr(obj.user, 'qr_code', None)
            return qr_code.get_qr_url if qr_code else None
        except Exception:
            return None

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
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'student_id', 'is_active', 'is_staff', 'is_banned', 'is_email_verified', 'date_joined']

