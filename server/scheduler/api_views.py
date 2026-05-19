from datetime import timedelta

from django.db.models import F
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from broadcast.models import BroadcastMessage
from dashboard.models import UserDetails

from .models import CalendarEvent, PageView, QuickStatusTemplate, RecurringSchedule
from .serializers import (
    CalendarEventSerializer,
    PageViewSerializer,
    QuickStatusTemplateSerializer,
    RecurringScheduleSerializer,
)
from .services import run_all


class RecurringScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringSchedule.objects.filter(user=self.request.user)


class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CalendarEvent.objects.filter(user=self.request.user)
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if start:
            qs = qs.filter(end_time__gte=start)
        if end:
            qs = qs.filter(start_time__lte=end)
        return qs


class QuickStatusTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = QuickStatusTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return QuickStatusTemplate.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """One-click activate a quick template as the current broadcast status."""
        template = self.get_object()
        BroadcastMessage.objects.filter(user=request.user, active=True).update(active=False)
        msg = BroadcastMessage.objects.create(
            user=request.user,
            message=template.message,
            active=True,
        )
        # Also set availability if configured
        if template.set_availability:
            try:
                details, _ = UserDetails.objects.get_or_create(user=request.user)
                details.is_available = (template.set_availability == 'true')
                details.save()
            except Exception:
                pass
        return Response({
            'message': f'Status set to: {template.label}',
            'broadcast_id': msg.id,
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_summary(request):
    """Return the last 30 days of page view analytics."""
    run_all(user=request.user)
    since = timezone.now().date() - timedelta(days=30)
    views = PageView.objects.filter(
        broadcaster=request.user,
        date__gte=since,
    )
    serializer = PageViewSerializer(views, many=True)
    total_views = sum(v.view_count for v in views)
    total_scans = sum(v.qr_scan_count for v in views)
    return Response({
        'total_views': total_views,
        'total_qr_scans': total_scans,
        'daily': serializer.data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def track_visit(request):
    """Public — called from the broadcast page to record a page view.

    Expects: ``{"slug": "<user_slug>", "source": "page"|"qr"}``
    Skips tracking if the visitor is the broadcaster themselves.
    """
    slug = request.data.get('slug', '').strip()
    source = request.data.get('source', 'page').strip().lower()
    if not slug:
        return Response({'error': 'slug required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_details = UserDetails.objects.select_related('user').get(_slug=slug)
    except UserDetails.DoesNotExist:
        return Response({'error': 'user not found'}, status=status.HTTP_404_NOT_FOUND)

    # Skip tracking if the visitor is the broadcaster (own page visit)
    if request.user and request.user.is_authenticated and request.user.pk == user_details.user.pk:
        return Response({'ok': True, 'skipped': 'own_visit'})

    today = timezone.now().date()
    pv, _ = PageView.objects.get_or_create(
        broadcaster=user_details.user,
        date=today,
    )
    if source == 'qr':
        PageView.objects.filter(pk=pv.pk).update(qr_scan_count=F('qr_scan_count') + 1)
    else:
        PageView.objects.filter(pk=pv.pk).update(view_count=F('view_count') + 1)

    return Response({'ok': True})
