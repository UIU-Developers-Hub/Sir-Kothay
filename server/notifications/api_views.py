from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from dashboard.models import UserDetails

from .models import StatusSubscription
from .serializers import StatusSubscriptionSerializer, SubscribeSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def subscribe(request, user_slug):
    """Public — subscribe an email to a broadcaster's status updates."""
    user_details = get_object_or_404(UserDetails, _slug=user_slug)
    serializer = SubscribeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']

    sub, created = StatusSubscription.objects.get_or_create(
        email=email,
        broadcaster=user_details.user,
        defaults={'is_active': True},
    )
    if not created and not sub.is_active:
        sub.is_active = True
        sub.save(update_fields=['is_active'])

    return Response(
        {'message': 'You will be notified when this person is available.'},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def unsubscribe(request, token):
    """Public — one-click unsubscribe via token in email link."""
    sub = get_object_or_404(StatusSubscription, unsubscribe_token=token)
    sub.is_active = False
    sub.save(update_fields=['is_active'])
    return Response({'message': 'You have been unsubscribed.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_subscribers(request):
    """Authenticated — list all subscribers for the current broadcaster."""
    subs = StatusSubscription.objects.filter(broadcaster=request.user)
    serializer = StatusSubscriptionSerializer(subs, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_subscriber(request, pk):
    """Authenticated — remove a subscriber."""
    sub = get_object_or_404(StatusSubscription, pk=pk, broadcaster=request.user)
    sub.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
