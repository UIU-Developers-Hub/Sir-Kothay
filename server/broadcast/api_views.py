from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import BroadcastMessage
from .serializers import BroadcastMessageSerializer
from dashboard.models import UserDetails


class BroadcastMessageViewSet(viewsets.ModelViewSet):
    queryset = BroadcastMessage.objects.all()
    serializer_class = BroadcastMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset to show user's own messages or all if staff"""
        BroadcastMessage.activate_due_messages()
        if self.request.user.is_staff:
            return BroadcastMessage.objects.all().order_by('-id')
        return BroadcastMessage.objects.filter(user=self.request.user).order_by('-id')
    
    def perform_create(self, serializer):
        """Set the user when creating a broadcast message"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_messages(self, request):
        """Get current user's broadcast messages"""
        BroadcastMessage.activate_due_messages(user=request.user)
        messages = BroadcastMessage.objects.filter(user=request.user).order_by('-id')
        serializer = BroadcastMessageSerializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def active_message(self, request):
        """Get current user's active broadcast message"""
        BroadcastMessage.activate_due_messages(user=request.user)
        try:
            message = BroadcastMessage.objects.get(user=request.user, active=True)
            serializer = BroadcastMessageSerializer(message)
            return Response(serializer.data)
        except BroadcastMessage.DoesNotExist:
            return Response({'error': 'No active message found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def set_active(self, request, pk=None):
        """Set a message as active"""
        message = self.get_object()
        if message.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        message.activate_now()
        return Response({'message': 'Message set as active'})


@api_view(['GET'])
@permission_classes([AllowAny]) 
def get_user_broadcast(request, user_slug):
    try:
        user_details = UserDetails.objects.select_related('user').get(_slug=user_slug)
        BroadcastMessage.activate_due_messages(user=user_details.user)
        
        # Get active broadcast message if exists
        active_message = BroadcastMessage.objects.filter(
            user=user_details.user,
            active=True
        ).first()

        # NOTE: Page tracking is handled by the client-side trackPageVisit()
        # call, NOT here. Doing both would double-count views.
        
        # Build response with user details and active message
        response_data = {
            'user_id': user_details.user.id,
            'username': user_details.user.username,
            'user_username': user_details.user.username,
            'email': user_details.user.email,
            'user_email': user_details.user.email,
            'phone_number': user_details.phone_number or '',
            'organization': user_details.organization or '',
            'designation': user_details.designation or '',
            'bio': user_details.bio or '',
            'profile_image': user_details.profile_image.url if user_details.profile_image else None,
            'active_message': active_message.message if active_message else None,
            'default_status': user_details.default_status,
            'is_available': user_details.is_available,
            'slug': user_details.slug
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except UserDetails.DoesNotExist:
        return Response({
            'error': 'User not found',
            'message': f'No user found with slug: {user_slug}'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': 'Server error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _track_page_view(broadcaster_user, request):
    """Increment the daily page-view counter for analytics."""
    try:
        from django.db.models import F
        from django.utils import timezone as tz
        from scheduler.models import PageView

        today = tz.now().date()
        source = request.query_params.get('source', 'page')
        pv, _ = PageView.objects.get_or_create(
            broadcaster=broadcaster_user,
            date=today,
        )
        if source == 'qr':
            PageView.objects.filter(pk=pv.pk).update(qr_scan_count=F('qr_scan_count') + 1)
        else:
            PageView.objects.filter(pk=pv.pk).update(view_count=F('view_count') + 1)
    except Exception:
        pass
