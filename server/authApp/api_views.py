from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from notifications.services import send_email_async
from .models import CustomUser, EmailVerificationToken
from .serializers import UserSerializer, UserLoginSerializer, ChangePasswordSerializer
import random
import string
import uuid
from django.utils import timezone
from datetime import timedelta

def generate_verification_code():
    return ''.join(random.choices(string.digits, k=6))

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user management
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        if self.action in ('create', 'login', 'register', 'request_password_reset', 'confirm_password_reset', 'verify_email_link', 'check_existence'):
            return [AllowAny()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def check_existence(self, request):
        email = request.data.get('email')
        student_id = request.data.get('student_id')
        
        errors = {}
        if email and CustomUser.objects.filter(email=email).exists():
            errors['email'] = 'A user with this email already exists.'
        if student_id and CustomUser.objects.filter(student_id=student_id).exists():
            errors['student_id'] = 'A user with this Student ID already exists.'
            
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'OK'}, status=status.HTTP_200_OK)

    def _send_verification_email(self, user, token_obj):
        client_base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', 'http://127.0.0.1:5500/client')
        verify_url = f"{client_base}/auth/verify-email.html?token={token_obj.token}"
        subject = "Verify your Sir Kothay Account"
        body = f"Hello {user.username},\n\nThank you for signing up for Sir Kothay!\n\nYour 6-digit verification code is: {token_obj.code}\n\nOr, you can click the link below to verify your email address:\n{verify_url}\n\nThanks,\nSir Kothay Team"
        send_email_async(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """Register a new user"""
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Create verification token
            token_obj = EmailVerificationToken.objects.create(
                user=user,
                token=str(uuid.uuid4()),
                code=generate_verification_code()
            )
            
            self._send_verification_email(user, token_obj)
            
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'User registered successfully. Please check your email for the verification code.',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        """Login user and return JWT tokens"""
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            user = authenticate(username=email, password=password)
            
            if user:
                if not user.is_email_verified:
                    try:
                        token_obj = EmailVerificationToken.objects.get(user=user)
                        if timezone.now() > token_obj.created_at + timedelta(minutes=10):
                            token_obj.token = str(uuid.uuid4())
                            token_obj.code = generate_verification_code()
                            token_obj.created_at = timezone.now()
                            token_obj.save()
                            self._send_verification_email(user, token_obj)
                    except EmailVerificationToken.DoesNotExist:
                        token_obj = EmailVerificationToken.objects.create(
                            user=user,
                            token=str(uuid.uuid4()),
                            code=generate_verification_code()
                        )
                        self._send_verification_email(user, token_obj)

                refresh = RefreshToken.for_user(user)
                return Response({
                    'message': 'Login successful',
                    'user': UserSerializer(user).data,
                    'tokens': {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                    }
                })
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user details"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        """Change user password"""
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'error': 'Wrong old password'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password changed successfully'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def request_password_reset(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = CustomUser.objects.filter(email=email).first()
        if user:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            client_base = getattr(settings, 'CLIENT_PUBLIC_BASE_URL', 'http://127.0.0.1:5500/client')
            reset_url = f"{client_base}/auth/reset-password.html?uidb64={uid}&token={token}"
            
            subject = "Reset your Sir Kothay Password"
            body = f"Hello,\n\nWe received a request to reset the password for your Sir Kothay account.\n\nClick the link below to set a new password:\n{reset_url}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nSir Kothay Team"
            
            send_email_async(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])
            
        return Response({'message': 'If that email is registered, a password reset link has been sent.'})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def confirm_password_reset(self, request):
        uidb64 = request.data.get('uidb64')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        if not uidb64 or not token or not new_password:
            return Response({'error': 'Missing data'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password has been reset with the new password.'})
        else:
            return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def verify_email(self, request):
        """Verify email using 6-digit code"""
        code = request.data.get('code')
        if not code:
            return Response({'error': 'Code is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token_obj = EmailVerificationToken.objects.get(user=request.user)
            if timezone.now() > token_obj.created_at + timedelta(minutes=10):
                return Response({'error': 'Verification code expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if token_obj.code == code:
                request.user.is_email_verified = True
                request.user.save()
                token_obj.delete()
                return Response({'message': 'Email verified successfully'})
            else:
                return Response({'error': 'Invalid verification code'}, status=status.HTTP_400_BAD_REQUEST)
        except EmailVerificationToken.DoesNotExist:
            if request.user.is_email_verified:
                return Response({'message': 'Email is already verified'})
            return Response({'error': 'Verification token not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def verify_email_link(self, request):
        """Verify email using URL token"""
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token_obj = EmailVerificationToken.objects.get(token=token)
            if timezone.now() > token_obj.created_at + timedelta(minutes=10):
                return Response({'error': 'Verification link expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
                
            user = token_obj.user
            user.is_email_verified = True
            user.save()
            token_obj.delete()
            return Response({'message': 'Email verified successfully'})
        except EmailVerificationToken.DoesNotExist:
            return Response({'error': 'Invalid or expired verification token'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def resend_verification(self, request):
        """Resend verification code/link to the authenticated user"""
        user = request.user
        if user.is_email_verified:
            return Response({'message': 'Email is already verified'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Optional: Allow changing email before resending
        new_email = request.data.get('email')
        if new_email and new_email != user.email:
            if CustomUser.objects.filter(email=new_email).exists():
                return Response({'error': 'This email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = new_email
            user.save()

        # Get or create token
        token_obj, created = EmailVerificationToken.objects.get_or_create(user=user, defaults={
            'token': str(uuid.uuid4()),
            'code': generate_verification_code()
        })
        
        if not created:
            # Refresh the code and token
            token_obj.token = str(uuid.uuid4())
            token_obj.code = generate_verification_code()
            token_obj.created_at = timezone.now()
            token_obj.save()
            
        self._send_verification_email(user, token_obj)
        return Response({'message': 'Verification email resent successfully'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def manual_verify(self, request, pk=None):
        """Admin endpoint to manually verify a user"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            
        user_to_verify = self.get_object()
        user_to_verify.is_email_verified = True
        user_to_verify.save()
        
        EmailVerificationToken.objects.filter(user=user_to_verify).delete()
        
        return Response({'message': f'User {user_to_verify.email} manually verified.'})
