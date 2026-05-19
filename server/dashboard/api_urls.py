from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import UserDetailsViewSet, StudentInterestViewSet, AdminUserManagementViewSet, SetStudentIdView

router = DefaultRouter()
router.register(r'user-details', UserDetailsViewSet, basename='userdetails')
router.register(r'student-interests', StudentInterestViewSet, basename='studentinterest')
router.register(r'admin-users', AdminUserManagementViewSet, basename='adminuser')
router.register(r'student', SetStudentIdView, basename='student-self')

urlpatterns = [
    path('', include(router.urls)),
]

