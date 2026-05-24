from django.contrib import admin
from .models import CustomUser, EmailVerificationToken

class CustomUserAdmin(admin.ModelAdmin):
    model = CustomUser
    list_display = ['email', 'username', 'role', 'is_email_verified', 'is_staff']
    search_fields = ['email', 'username', 'student_id']
    list_filter = ['is_email_verified', 'role', 'is_banned', 'is_staff']

@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'code', 'created_at']
    search_fields = ['user__email', 'code']

admin.site.register(CustomUser, CustomUserAdmin)
