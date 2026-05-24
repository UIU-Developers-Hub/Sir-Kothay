from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api_views

router = DefaultRouter()
router.register(r'recurring', api_views.RecurringScheduleViewSet, basename='recurringschedule')
router.register(r'calendar', api_views.CalendarEventViewSet, basename='calendarevent')
router.register(r'templates', api_views.QuickStatusTemplateViewSet, basename='quicktemplate')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/', api_views.analytics_summary, name='analytics_summary'),
    path('analytics/track/', api_views.track_visit, name='analytics_track'),
]
