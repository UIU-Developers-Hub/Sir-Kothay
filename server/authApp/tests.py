import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from .models import CustomUser, EmailVerificationToken
from .serializers import UserSerializer


class AccountIdentityTests(TestCase):
    def test_email_is_one_case_insensitive_account_and_admin_is_an_overlay(self):
        user = CustomUser.objects.create_user(
            email='Student@Example.com',
            username='student-one',
            password='StrongPass123!',
            role='STUDENT',
            is_staff=True,
        )

        self.assertEqual(user.email, 'student@example.com')
        self.assertEqual(user.role, 'STUDENT')
        self.assertTrue(user.is_staff)

        duplicate = UserSerializer(data={
            'email': 'STUDENT@example.com',
            'username': 'faculty-one',
            'password': 'StrongPass123!',
            'role': 'FACULTY',
        })
        self.assertFalse(duplicate.is_valid())
        self.assertIn('email', duplicate.errors)


class VerificationLinkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            email='verify@example.com',
            username='verify-user',
            password='StrongPass123!',
            role='STUDENT',
        )
        self.token = EmailVerificationToken.objects.create(
            user=self.user,
            token=str(uuid.uuid4()),
            code='123456',
        )

    def test_link_verification_returns_a_session_for_the_browser_that_opened_it(self):
        response = self.client.post(
            '/api/auth/users/verify_email_link/',
            {'token': self.token.token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertTrue(response.data['user']['is_email_verified'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_email_verified)
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())

    def test_deactivated_verified_account_does_not_receive_a_new_session(self):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])

        response = self.client.post(
            '/api/auth/users/verify_email_link/',
            {'token': self.token.token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('tokens', response.data)
