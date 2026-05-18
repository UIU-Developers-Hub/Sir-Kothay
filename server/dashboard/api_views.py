from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import UserDetails, StudentInterest
from .serializers import UserDetailsSerializer, StudentInterestSerializer, AdminUserSerializer
from authApp.models import CustomUser


class UserDetailsViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user details management
    """
    queryset = UserDetails.objects.all()
    serializer_class = UserDetailsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset to only show authenticated user's details"""
        if self.request.user.is_staff:
            return UserDetails.objects.all()
        return UserDetails.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_details(self, request):
        """Get current user's details"""
        try:
            user_details, created = UserDetails.objects.get_or_create(user=request.user)
            serializer = UserDetailsSerializer(user_details)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['put', 'patch'], permission_classes=[IsAuthenticated])
    def update_my_details(self, request):
        """Update current user's details"""
        try:
            user_details, created = UserDetails.objects.get_or_create(user=request.user)
            serializer = UserDetailsSerializer(user_details, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StudentInterestViewSet(viewsets.ModelViewSet):
    """
    API endpoint for students to manage their interested faculties
    """
    serializer_class = StudentInterestSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return StudentInterest.objects.filter(student=self.request.user)


    @action(detail=False, methods=['get'])
    def feed(self, request):
        """Get recent status updates of interested faculties"""
        # We can just return the interested faculties, their current status is in faculty_details
        interests = self.get_queryset()
        serializer = self.get_serializer(interests, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search_faculties(self, request):
        query = request.query_params.get('q', '').lower()
        if not query:
            return Response([])
        from django.db.models import Q
        faculties = CustomUser.objects.filter(role='FACULTY').filter(
            Q(username__icontains=query) | Q(email__icontains=query)
        )[:20]
        
        results = []
        for fac in faculties:
            try:
                details = UserDetails.objects.get(user=fac)
                results.append({
                    'user': fac.id,
                    'username': fac.username,
                    'email': fac.email,
                    'designation': details.designation,
                    'profile_image_url': details.get_image_url,
                })
            except UserDetails.DoesNotExist:
                pass
        return Response(results)

class AdminUserManagementViewSet(viewsets.ModelViewSet):
    """
    API endpoint for admins to manage users
    """
    queryset = CustomUser.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        if not self.request.user.role == 'ADMIN':
            return CustomUser.objects.none()
        return CustomUser.objects.all()

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        if not request.user.role == 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'success', 'is_active': user.is_active})
