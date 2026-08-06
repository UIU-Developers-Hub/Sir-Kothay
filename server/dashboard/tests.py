from django.test import TestCase
from rest_framework.test import APIClient

from authApp.models import CustomUser
from .models import StudentInterest


class PublicPagePreferenceTests(TestCase):
    def setUp(self):
        self.student = CustomUser.objects.create_user(
            email='student@example.com',
            username='student',
            password='StrongPass123!',
            role='STUDENT',
        )
        self.faculty = CustomUser.objects.create_user(
            email='faculty@example.com',
            username='faculty',
            password='StrongPass123!',
            role='FACULTY',
        )
        self.other_faculty = CustomUser.objects.create_user(
            email='other@example.com',
            username='other-faculty',
            password='StrongPass123!',
            role='FACULTY',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def set_preference(self, faculty, preference):
        return self.client.post(
            '/api/dashboard/student-interests/set_preference/',
            {'faculty': faculty.pk, 'notify_preference': preference},
            format='json',
        )

    def test_enabling_from_public_page_adds_faculty_then_updates_same_interest(self):
        response = self.set_preference(self.faculty, StudentInterest.NOTIFY_ALL)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['created'])
        self.assertTrue(response.data['added_to_dashboard'])

        interest = StudentInterest.objects.get(student=self.student, faculty=self.faculty)
        self.assertEqual(interest.notify_preference, StudentInterest.NOTIFY_ALL)

        response = self.set_preference(self.faculty, StudentInterest.NOTIFY_AVAILABLE)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['created'])
        self.assertEqual(StudentInterest.objects.filter(student=self.student, faculty=self.faculty).count(), 1)
        interest.refresh_from_db()
        self.assertEqual(interest.notify_preference, StudentInterest.NOTIFY_AVAILABLE)

    def test_off_works_without_creating_an_unfollowed_faculty(self):
        response = self.set_preference(self.other_faculty, StudentInterest.NOTIFY_NONE)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['interest_id'])
        self.assertFalse(response.data['added_to_dashboard'])
        self.assertFalse(StudentInterest.objects.filter(student=self.student, faculty=self.other_faculty).exists())
