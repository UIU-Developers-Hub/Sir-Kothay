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
        return StudentInterest.objects.filter(student=self.request.user).select_related('student', 'faculty')


    @action(detail=False, methods=['get'])
    def available_count(self, request):
        """Return a lightweight count of followed faculties that are currently available."""
        count = self.get_queryset().filter(faculty__details__is_available=True).count()
        return Response({'available_count': count})

    @action(detail=False, methods=['get'])
    def feed(self, request):
        """Get chronological status updates of interested faculties"""
        from .models import FacultyActivity
        faculty_ids = self.get_queryset().values_list('faculty_id', flat=True)
        activities = FacultyActivity.objects.filter(faculty_id__in=faculty_ids).order_by('-created_at')[:50]
        
        results = []
        for act in activities:
            try:
                details = UserDetails.objects.get(user=act.faculty)
                results.append({
                    'id': act.id,
                    'faculty_id': act.faculty.id,
                    'faculty_username': act.faculty.username,
                    'profile_image_url': details.get_image_url,
                    'slug': details.slug,
                    'title': act.title,
                    'details': act.details,
                    'is_available': act.is_available,
                    'created_at': act.created_at.isoformat(),
                })
            except UserDetails.DoesNotExist:
                continue
                
        return Response(results)

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
    API endpoint for admins (is_staff=True) to manage users.
    """
    queryset = CustomUser.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def _is_admin(self, request):
        return request.user.is_staff

    def get_queryset(self):
        if not self._is_admin(self.request):
            return CustomUser.objects.none()
        return CustomUser.objects.all().order_by('id')

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return Response({'error': 'Cannot delete yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Deactivate / Activate a user (separate from ban)."""
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        if user.id == request.user.id:
            return Response({'error': 'Cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_banned:
            return Response({'error': 'User is banned. Unban first.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'success', 'is_active': user.is_active, 'is_banned': user.is_banned})

    @action(detail=True, methods=['post'])
    def ban_user(self, request, pk=None):
        """Ban a user — sets is_banned=True and is_active=False."""
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        if user.id == request.user.id:
            return Response({'error': 'Cannot ban yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_banned = True
        user.is_active = False
        user.save()
        return Response({'status': 'success', 'is_active': False, 'is_banned': True})

    @action(detail=True, methods=['post'])
    def unban_user(self, request, pk=None):
        """Unban a user — sets is_banned=False and is_active=True."""
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        user.is_banned = False
        user.is_active = True
        user.save()
        return Response({'status': 'success', 'is_active': True, 'is_banned': False})

    @action(detail=True, methods=['post'])
    def toggle_admin(self, request, pk=None):
        """Grant or revoke admin (is_staff) privilege."""
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        # If revoking admin, ensure at least one admin remains
        if user.is_staff:
            admin_count = CustomUser.objects.filter(is_staff=True).count()
            if admin_count <= 1:
                return Response({'error': 'Cannot remove the last admin. Promote another user first.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_staff = not user.is_staff
        user.save()
        return Response({'status': 'success', 'is_staff': user.is_staff})

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """
        Change user role between FACULTY, STUDENT, or '' (none/admin-only).
        Student→Faculty/None: clears student_id.
        *→Student: optionally accepts student_id in body.
        """
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        new_role = request.data.get('role')
        if new_role is None:
            return Response({'error': 'role field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_role not in ('FACULTY', 'STUDENT', ''):
            return Response({'error': 'Invalid role. Choose FACULTY, STUDENT, or empty.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.role == new_role:
            label = new_role or 'None'
            return Response({'error': f'User is already {label}.'}, status=status.HTTP_400_BAD_REQUEST)

        old_role = user.role
        user.role = new_role
        if new_role != 'STUDENT':
            # Clear student_id when moving away from student
            user.student_id = None
        elif new_role == 'STUDENT':
            # Optionally accept student_id
            sid = request.data.get('student_id', '').strip()
            if sid:
                if CustomUser.objects.filter(student_id=sid).exclude(pk=user.pk).exists():
                    return Response({'error': f'Student ID "{sid}" is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
                user.student_id = sid
            # If no sid provided, student will be prompted on next login.
        user.save()
        return Response({
            'status': 'success', 'role': user.role,
            'student_id': user.student_id, 'old_role': old_role
        })

    @action(detail=True, methods=['post'], url_path='reset_password')
    def reset_password(self, request, pk=None):
        """
        Admin resets a user's password. Accepts optional 'password' in request data.
        If provided, sets that password. Otherwise, generates a random password,
        sets it, and emails the user.
        """
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        
        custom_password = request.data.get('password', '').strip()
        
        if custom_password:
            new_password = custom_password
        else:
            import secrets
            new_password = secrets.token_urlsafe(8)[:8]
            
        user.set_password(new_password)
        user.save()
        
        from notifications.services import auth_login_url, send_email_async
        from django.conf import settings
        subject = "Your Sir Kothay Password has been Reset"
        body = f"Hello {user.username},\n\nAn administrator has reset your password.\n\nYour new password is: {new_password}\n\nPlease log in and change this password from your profile settings as soon as possible.\n\nThanks,\nSir Kothay Team"
        send_email_async(
            subject,
            body,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sirkothay.com'),
            [user.email],
            eyebrow='Account access',
            title='Your password was reset',
            greeting=user.username,
            intro=[
                'An administrator reset the password for your Sir Kothay account.',
                'Use the temporary password below, then change it from your profile settings.'
            ],
            facts=[('Temporary password', new_password)],
            action_label='Log in',
            action_url=auth_login_url(),
            footer_note='Keep this password private and change it after signing in.',
        )
        
        msg = 'Custom password set' if custom_password else 'Random password generated'
        return Response({'status': 'success', 'message': f'{msg} and emailed to the user.'})

    @action(detail=True, methods=['post'], url_path='toggle_verify')
    def toggle_verify(self, request, pk=None):
        """
        Admin toggles a user's email verification status.
        """
        if not self._is_admin(request):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        user.is_email_verified = not user.is_email_verified
        user.save()
        
        if user.is_email_verified:
            from authApp.models import EmailVerificationToken
            EmailVerificationToken.objects.filter(user=user).delete()
        
        status_text = 'verified' if user.is_email_verified else 'unverified'
        return Response({'status': 'success', 'message': f'User marked as {status_text}.', 'is_email_verified': user.is_email_verified})


class SetStudentIdView(viewsets.ViewSet):
    """
    Allows a STUDENT to set their own student_id if not yet set.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='set-student-id')
    def set_student_id(self, request):
        user = request.user
        if user.role != 'STUDENT':
            return Response({'error': 'Only students can set a student ID.'}, status=status.HTTP_400_BAD_REQUEST)
        sid = request.data.get('student_id', '').strip()
        if not sid:
            return Response({'error': 'Student ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if CustomUser.objects.filter(student_id=sid).exclude(pk=user.pk).exists():
            return Response({'error': f'Student ID "{sid}" is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
        user.student_id = sid
        user.save()
        return Response({'status': 'success', 'student_id': user.student_id})

