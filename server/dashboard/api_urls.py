from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import UserDetailsViewSet, StudentInterestViewSet, AdminUserManagementViewSet

router = DefaultRouter()
router.register(r'user-details', UserDetailsViewSet, basename='userdetails')
router.register(r'student-interests', StudentInterestViewSet, basename='studentinterest')
router.register(r'admin-users', AdminUserManagementViewSet, basename='adminuser')

urlpatterns = [
    path('', include(router.urls)),
]
