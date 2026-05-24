from django.contrib import admin

from .models import StatusSubscription


@admin.register(StatusSubscription)
class StatusSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('email', 'broadcaster', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('email',)
