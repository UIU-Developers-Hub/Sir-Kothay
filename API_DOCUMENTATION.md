# Sir Kothay — REST API Documentation

## Base URL
```
http://127.0.0.1:8000/api/
```
> On LAN, replace `127.0.0.1` with your PC's IP (e.g. `192.168.1.100`).

## Authentication
All authenticated endpoints require a JWT Bearer token:
```
Authorization: Bearer <access_token>
```
Tokens expire after **5 hours**. Use the refresh token to obtain a new access token.

---

## 1 · Authentication

### 1.1 Register
**POST** `/api/auth/users/register/`

```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "role": "FACULTY"
}
```
`role`: `"FACULTY"` or `"STUDENT"` (default: `"FACULTY"`).
`student_id`: optional at registration. Students are prompted to set it on first dashboard visit.

**Response:** `201` — user object + `tokens.access` / `tokens.refresh`

---

### 1.2 Login
**POST** `/api/auth/users/login/`

```json
{ "email": "user@example.com", "password": "password123" }
```
> Also accepts `student_id` as the identifier field for student login.

**Response:** `200` — user object + tokens

---

### 1.3 Get Current User
**GET** `/api/auth/users/me/` · 🔒 JWT

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "Dr. Smith",
  "role": "FACULTY",
  "student_id": null,
  "is_staff": false,
  "is_active": true,
  "date_joined": "2026-05-18T12:00:00Z"
}
```
`role`: `"FACULTY"`, `"STUDENT"`, or `""` (empty = admin-only, no dashboard role).
`is_staff`: `true` if the user has admin panel access.

---

### 1.4 Change Password
**POST** `/api/auth/users/change_password/` · 🔒 JWT

```json
{ "old_password": "current", "new_password": "newpassword123" }
```

---

### 1.5 List All Users (Admin)
**GET** `/api/auth/users/` · 🔒 JWT (staff only) · Paginated

---

## 2 · User Details (Dashboard)

### 2.1 Get My Details
**GET** `/api/dashboard/user-details/my_details/` · 🔒 JWT

Auto-creates a `UserDetails` record if one doesn't exist (via `get_or_create`).

**Response:**
```json
{
  "id": 1,
  "user": 1,
  "user_email": "user@example.com",
  "user_username": "Dr. Smith",
  "profile_image": "/media/profile_images/photo.jpg",
  "profile_image_url": "/media/profile_images/photo.jpg",
  "phone_number": "01XXXXXXXXX",
  "bio": "...",
  "designation": "Associate Professor",
  "organization": "UIU",
  "default_status": "Away from desk",
  "default_availability": true,
  "is_available": true,
  "slug": "dr-smith-1",
  "notify_new_chats": true,
  "notify_chat_replies": false,
  "notify_chat_closed": true,
  "auto_close_hours": 48
}
```

| Field | Type | Description |
|-------|------|-------------|
| `default_status` | string | Fallback broadcast message activated when a timed status expires |
| `default_availability` | bool | Fallback availability state when a timed status expires |
| `is_available` | bool | Current availability (toggling to `true` notifies subscribers) |
| `notify_new_chats` | bool | Email on new chat thread initiated |
| `notify_chat_replies` | bool | Email on each reply in active threads |
| `notify_chat_closed` | bool | Email when a chat thread is closed |
| `auto_close_hours` | int/null | Hours of inactivity before auto-closing chat threads. `null` = never |
| `slug` | string | Auto-generated public URL slug (read-only, syncs with username) |

---

### 2.2 Update My Details
**PUT/PATCH** `/api/dashboard/user-details/update_my_details/` · 🔒 JWT

Accepts any subset of: `phone_number`, `bio`, `designation`, `organization`, `default_status`, `default_availability`, `is_available`, `profile_image` (multipart), `notify_new_chats`, `notify_chat_replies`, `notify_chat_closed`, `auto_close_hours`.

**Proxy fields** (write-only, updates the linked user account):
- `username` — change display name
- `email` — change email address

---

### 2.3 List All User Details
**GET** `/api/dashboard/user-details/` · 🔒 JWT · Paginated

---

## 3 · Student Interests

### 3.1 List My Interests
**GET** `/api/dashboard/student-interests/` · 🔒 JWT (Student)

**Response:**
```json
[
  {
    "id": 1,
    "student": 2,
    "faculty": 1,
    "faculty_username": "Dr. Smith",
    "faculty_details": {
      "designation": "Associate Professor",
      "organization": "UIU",
      "profile_image_url": "/media/profile_images/photo.jpg",
      "is_available": true,
      "slug": "dr-smith-1"
    },
    "notify_preference": "available",
    "created_at": "2026-05-18T12:00:00Z"
  }
]
```

Each entry includes the full `faculty_details` nested object with availability, profile image, and broadcast slug.

---

### 3.2 Add Interest
**POST** `/api/dashboard/student-interests/` · 🔒 JWT

```json
{ "faculty": 1, "notify_preference": "all" }
```
`notify_preference`: `"all"` | `"available"` | `"none"` (default: `"none"`)

---

### 3.3 Update Notification Preference
**PATCH** `/api/dashboard/student-interests/{id}/` · 🔒 JWT

```json
{ "notify_preference": "available" }
```

---

### 3.4 Remove Interest
**DELETE** `/api/dashboard/student-interests/{id}/` · 🔒 JWT

---

### 3.5 Faculty Feed
**GET** `/api/dashboard/student-interests/feed/` · 🔒 JWT

Returns status updates of all interested faculties.

---

### 3.6 Search Faculties
**GET** `/api/dashboard/student-interests/search_faculties/?q=smith` · 🔒 JWT

Searches faculty by username or email. Returns up to 20 results.

**Response:**
```json
[
  {
    "user": 1,
    "username": "Dr. Smith",
    "email": "smith@uiu.ac.bd",
    "designation": "Associate Professor",
    "profile_image_url": "/media/profile_images/photo.jpg"
  }
]
```

---

## 4 · Admin User Management

> **Authorization:** All endpoints require `is_staff=True`. Admin is a privilege (`is_staff`), not a role.

### 4.1 List All Users
**GET** `/api/dashboard/admin-users/` · 🔒 JWT (staff)

Returns all users with fields: `id`, `username`, `email`, `role`, `student_id`, `is_staff`, `is_banned`, `is_active`, `first_name`, `last_name`, `date_joined`.

---

### 4.2 Toggle User Active (Deactivate/Activate)
**POST** `/api/dashboard/admin-users/{id}/toggle_active/` · 🔒 JWT (staff)

Toggles `is_active`. Cannot deactivate yourself. Cannot toggle if user is banned (unban first).

**Response:** `{ "status": "success", "is_active": false, "is_banned": false }`

---

### 4.3 Ban User
**POST** `/api/dashboard/admin-users/{id}/ban_user/` · 🔒 JWT (staff)

Sets `is_banned=True` and `is_active=False`. Banned users cannot log in. Cannot ban yourself.

**Response:** `{ "status": "success", "is_active": false, "is_banned": true }`

---

### 4.4 Unban User
**POST** `/api/dashboard/admin-users/{id}/unban_user/` · 🔒 JWT (staff)

Sets `is_banned=False` and `is_active=True`.

**Response:** `{ "status": "success", "is_active": true, "is_banned": false }`

---

### 4.5 Toggle Admin Privilege
**POST** `/api/dashboard/admin-users/{id}/toggle_admin/` · 🔒 JWT (staff)

Grants or revokes `is_staff`. **Cannot remove the last admin** — at least one admin must remain.

**Response:** `{ "status": "success", "is_staff": true }`

---

### 4.6 Change Role
**POST** `/api/dashboard/admin-users/{id}/change_role/` · 🔒 JWT (staff)

```json
{ "role": "STUDENT", "student_id": "0112430141" }
```
`role`: `"FACULTY"`, `"STUDENT"`, or `""` (empty = admin-only).
`student_id`: optional, only when changing to `STUDENT`.

**Behavior:**
- Changing away from `STUDENT` clears `student_id`.
- Changing to `STUDENT` without `student_id` prompts the user on next login.
- Admins can change their own role.

**Response:** `{ "status": "success", "role": "STUDENT", "student_id": "0112430141", "old_role": "FACULTY" }`

---

### 4.7 Delete User
**DELETE** `/api/dashboard/admin-users/{id}/` · 🔒 JWT (staff)

Permanently deletes the user. Cannot delete yourself.

---

### 4.8 Set Student ID (Self-Service)
**POST** `/api/dashboard/student/set-student-id/` · 🔒 JWT (Student)

```json
{ "student_id": "0112430141" }
```

Students without a `student_id` are prompted to set one upon visiting the dashboard. This endpoint handles that self-service flow.

**Response:** `{ "status": "success", "student_id": "0112430141" }`

---

## 5 · Broadcast Messages

### 5.1 List My Messages
**GET** `/api/broadcast/messages/my_messages/` · 🔒 JWT

**Response:** array of message objects:
```json
[
  {
    "id": 1,
    "user": 1,
    "message": "In Room 405",
    "active": true,
    "scheduled_for": null,
    "duration_seconds": 3600,
    "active_until": "2026-05-18T13:00:00Z",
    "set_availability": "true",
    "created_at": "2026-05-18T12:00:00Z"
  }
]
```

---

### 5.2 Get Active Message
**GET** `/api/broadcast/messages/active_message/` · 🔒 JWT

---

### 5.3 Create Message
**POST** `/api/broadcast/messages/` · 🔒 JWT

```json
{
  "message": "In Room 405 until 3pm",
  "active": true,
  "scheduled_for": null,
  "duration_seconds": 3600,
  "set_availability": "true"
}
```
`duration_seconds`: null = "Until I change". Positive integer = auto-expire after N seconds.
`set_availability`: `"true"` = set Available, `"false"` = set Unavailable, `""` = no change.

---

### 5.4 Update Message
**PATCH** `/api/broadcast/messages/{id}/` · 🔒 JWT

---

### 5.5 Delete Message
**DELETE** `/api/broadcast/messages/{id}/` · 🔒 JWT · `204 No Content`

---

### 5.6 Toggle Active (Set Active)
**POST** `/api/broadcast/messages/{id}/set_active/` · 🔒 JWT

Deactivates all other messages and activates the specified one. Non-staff users can only activate their own messages.

Also processes scheduled messages and expires timed statuses on each request.

---

### 5.7 Public Broadcast (No Auth)
**GET** `/api/broadcast/<user_slug>/` · 🌐 Public

Returns user profile + active broadcast message for the public broadcast page and QR code scanning.

**Response:**
```json
{
  "user_id": 1,
  "username": "Dr. Smith",
  "user_username": "Dr. Smith",
  "email": "user@example.com",
  "user_email": "user@example.com",
  "phone_number": "01XXXXXXXXX",
  "organization": "UIU",
  "designation": "Lecturer",
  "bio": "...",
  "profile_image": "/media/profile_images/photo.jpg",
  "active_message": "In Room 405 until 3pm",
  "default_status": "Away from desk",
  "is_available": true,
  "slug": "dr-smith-1"
}
```

---

## 6 · QR Code

### 6.1 Get My QR Code
**GET** `/api/qrcode/qrcodes/my_qrcode/` · 🔒 JWT

**Response:**
```json
{
  "id": 1,
  "user": 1,
  "image": "/media/qr_codes/qr_1_drsmith.png",
  "generated_at": "2026-05-18T12:00:00Z"
}
```

---

### 6.2 Generate / Regenerate QR Code
**POST** `/api/qrcode/qrcodes/generate/` · 🔒 JWT

**Response:**
```json
{
  "message": "QR code generated successfully",
  "qr_code": { "id": 1, "image": "/media/qr_codes/qr_1_drsmith.png" },
  "public_profile_url": "http://192.168.1.100:5500/broadcast/message.html?user=dr-smith-1"
}
```

---

### 6.3 QR PNG Export
**GET** `/api/qrcode/qrcodes/qr_png/` · 🔒 JWT

Returns raw PNG bytes. Set `Accept: image/png`.

---

### 6.4 Footer PNG Export
**GET** `/api/qrcode/qrcodes/footer_png/` · 🔒 JWT

Returns the branded footer PNG for "QR with user info" downloads.

---

## 7 · Direct Messaging (Anonymous Visitors)

### 7.1 Send Message to Broadcaster (Public)
**POST** `/api/messaging/<user_slug>/send/` · 🌐 Public

```json
{
  "sender_name": "John",
  "sender_email": "john@example.com",
  "subject": "Question about office hours",
  "body": "When are you available today?"
}
```

---

### 7.2 Inbox
**GET** `/api/messaging/inbox/` · 🔒 JWT

Returns all visitor messages received by the authenticated broadcaster. Each message is annotated with **sender verification** fields:

| Field | Description |
|-------|-------------|
| `sender_is_registered` | `true` if the sender email matches a registered user |
| `sender_user_id` | User ID if registered, else `null` |
| `sender_role` | `"FACULTY"`, `"STUDENT"`, or `null` |
| `sender_student_id` | Student ID if available, else `null` |

---

### 7.3 Unread Count
**GET** `/api/messaging/unread/` · 🔒 JWT

**Response:** `{ "unread_count": 3 }`

---

### 7.4 Message Detail
**GET** `/api/messaging/{id}/` · 🔒 JWT

Returns full message details and marks it as read.

---

### 7.5 Reply to Message
**POST** `/api/messaging/{id}/reply/` · 🔒 JWT

```json
{ "body": "I'll be available at 3pm." }
```

Replies are **append-only** — each reply is timestamped and appended to the conversation thread (separated by `---REPLY_SEP---`). An **email notification** is sent to the visitor's email address with the reply.

---

### 7.6 Close Visitor DM
**POST** `/api/messaging/{id}/close-dm/` · 🔒 JWT

---

### 7.7 Delete Visitor DM
**DELETE** `/api/messaging/{id}/delete/` · 🔒 JWT

---

## 8 · Threaded Chat (Student ↔ Faculty)

### 8.1 Initiate Chat
**POST** `/api/messaging/chat/initiate/` · 🔒 JWT (Student)

```json
{
  "faculty_id": 1,
  "subject": "Office hours query",
  "body": "Hi, are you available this week?"
}
```
Creates a new thread with status `PENDING`. Faculty receives an email notification.

---

### 8.2 List Threads
**GET** `/api/messaging/chat/threads/` · 🔒 JWT

Returns all chat threads for the current user (excluding soft-deleted threads). Supports `?status=ACTIVE` filter.

---

### 8.3 Thread Detail
**GET** `/api/messaging/chat/{id}/` · 🔒 JWT

Returns full thread with all messages, student/faculty info, and status.

**Response:**
```json
{
  "id": 1,
  "student": 2,
  "faculty": 1,
  "student_info": { "username": "Alice", "email": "...", "student_id": "011..." },
  "faculty_info": { "username": "Dr. Smith", "slug": "dr-smith-1" },
  "subject": "Office hours query",
  "status": "ACTIVE",
  "messages": [
    {
      "id": 1,
      "sender": 2,
      "sender_name": "Alice",
      "body": "Hi, are you available?",
      "created_at": "2026-05-18T12:00:00Z"
    }
  ],
  "last_activity_at": "2026-05-18T12:05:00Z"
}
```

---

### 8.4 Accept Thread
**POST** `/api/messaging/chat/{id}/accept/` · 🔒 JWT (Faculty)

Changes status from `PENDING` → `ACTIVE`.

---

### 8.5 Reply to Thread
**POST** `/api/messaging/chat/{id}/reply/` · 🔒 JWT

```json
{ "body": "Yes, come to Room 405." }
```
**Rules:** Faculty can only reply when status is `ACTIVE`. Students can reply in both `PENDING` and `ACTIVE` threads (follow-up before acceptance). Email notification sent to the other party based on their `notify_chat_replies` setting.

---

### 8.6 Close Thread
**POST** `/api/messaging/chat/{id}/close/` · 🔒 JWT

Changes status to `CLOSED`. No more messages can be sent.

---

### 8.7 Check Existing Thread
**GET** `/api/messaging/chat/check/{faculty_id}/` · 🔒 JWT (Student)

**Response:**
```json
{ "has_thread": true, "thread_id": 5, "status": "ACTIVE" }
```

---

### 8.8 Delete Thread (Soft Delete)
**DELETE** `/api/messaging/chat/{id}/delete/` · 🔒 JWT

Closes the thread (if open) and soft-deletes it **for the requesting user only**. The other party still sees it. If both sides delete, the thread is permanently removed from the database.

---

### 8.9 Close & Delete All
**POST** `/api/messaging/chat/delete-all/` · 🔒 JWT

Closes all open threads and soft-deletes all threads for the requesting user.

**Response:**
```json
{ "message": "5 thread(s) deleted.", "count": 5 }
```

---

## 9 · Notifications (Subscribers)

### 9.1 Subscribe to Broadcaster (Public)
**POST** `/api/notifications/subscribe/<user_slug>/` · 🌐 Public

```json
{ "email": "subscriber@example.com" }
```

Anonymous subscribers receive an email when the broadcaster toggles to "Available".

---

### 9.2 Unsubscribe
**GET** `/api/notifications/unsubscribe/<token>/` · 🌐 Public

Token-based unsubscribe link (included in notification emails).

---

### 9.3 List My Subscribers
**GET** `/api/notifications/subscribers/` · 🔒 JWT

---

### 9.4 Remove Subscriber
**DELETE** `/api/notifications/subscribers/{id}/` · 🔒 JWT

---

## 10 · Scheduler

### 10.1 Recurring Schedules (CRUD)
**Base:** `/api/scheduler/recurring/` · 🔒 JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recurring/` | List all my recurring schedules |
| POST | `/recurring/` | Create a new recurring schedule |
| PATCH | `/recurring/{id}/` | Update a schedule |
| DELETE | `/recurring/{id}/` | Delete a schedule |

**Create body:**
```json
{
  "day_of_week": 0,
  "time_of_day": "14:00:00",
  "message": "Office Hours — Room 405",
  "duration_seconds": 7200,
  "set_availability": "true",
  "is_active": true
}
```
`day_of_week`: 0=Monday … 6=Sunday.
`set_availability`: `"true"` | `"false"` | `""` (no change).

---

### 10.2 Calendar Events (CRUD)
**Base:** `/api/scheduler/calendar/` · 🔒 JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/calendar/?start=ISO&end=ISO` | List events in date range |
| POST | `/calendar/` | Create a new event |
| PATCH | `/calendar/{id}/` | Update an event |
| DELETE | `/calendar/{id}/` | Delete an event |

**Create body:**
```json
{
  "title": "Faculty Meeting",
  "description": "Monthly departmental meeting",
  "start_time": "2026-05-20T10:00:00Z",
  "end_time": "2026-05-20T12:00:00Z",
  "color": "#f68b1f",
  "all_day": false,
  "recurrence_rule": "none",
  "set_availability": "false"
}
```
`all_day`: `true` for all-day events.
`recurrence_rule`: `"none"` | `"daily"` | `"weekly"` | `"monthly"`.

---

### 10.3 Quick Status Templates (CRUD)
**Base:** `/api/scheduler/templates/` · 🔒 JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates/` | List all my templates |
| POST | `/templates/` | Create a new template |
| PATCH | `/templates/{id}/` | Update a template |
| DELETE | `/templates/{id}/` | Delete a template |

**Create body:**
```json
{
  "label": "In a Meeting",
  "message": "Currently in a meeting, please check back later.",
  "icon": "bi-camera-video-fill",
  "set_availability": "false",
  "sort_order": 0
}
```
`sort_order`: integer for display ordering (lower = first).

### 10.4 Activate Template
**POST** `/api/scheduler/templates/{id}/activate/` · 🔒 JWT

One-click activate a quick template as the current broadcast status. Also sets availability if configured.

---

## 11 · Analytics

### 11.1 Analytics Summary
**GET** `/api/scheduler/analytics/` · 🔒 JWT

**Response:**
```json
{
  "total_views": 142,
  "total_qr_scans": 38,
  "daily": [
    { "date": "2026-05-18", "view_count": 12, "qr_scan_count": 3 }
  ]
}
```

---

### 11.2 Track Visit
**POST** `/api/scheduler/analytics/track/` · 🌐 Public (optional JWT)

```json
{ "slug": "dr-smith-1", "source": "page" }
```
`source`: `"page"` or `"qr"`. If JWT is included, self-visits are skipped.

---

## 12 · Server Info

### 12.1 Server Index
**GET** `/index/` · 🌐 Public

Returns API metadata and available endpoint groups.

**Response:**
```json
{
  "message": "Sir Kothay API Server",
  "version": "1.0",
  "documentation": "/api/",
  "endpoints": {
    "auth": "/api/auth/",
    "dashboard": "/api/dashboard/",
    "qrcode": "/api/qrcode/",
    "broadcast": "/api/broadcast/"
  }
}
```

---

### 12.2 About & Contributors
**GET** `/about/` · 🌐 Public

Returns project info and a live contributor list fetched from the GitHub API (configurable via `GITHUB_CONTRIBUTORS_REPO` env var).

---

## 13 · Management Commands

| Command | Description |
|---------|-------------|
| `python manage.py process_schedules` | Expires timed messages, triggers recurring schedules, syncs calendar events |
| `python manage.py close_stale_chats` | Auto-closes inactive chat threads based on faculty `auto_close_hours` setting |
| `python manage.py createsuperuser` | Create a Django superuser (standard Django command) |

Set these up as cron jobs or PythonAnywhere scheduled tasks for production.

---

## Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "field_name": ["Error message"] }` |
| `401` | `{ "detail": "Authentication credentials were not provided." }` |
| `403` | `{ "error": "Not authorized." }` |
| `404` | `{ "error": "User not found" }` |

---

## Pagination

List endpoints return paginated results:
```json
{ "count": 50, "next": "...?page=2", "previous": null, "results": [...] }
```
Query params: `page` (default 1), `page_size` (default 10, max 100).
> Note: Some endpoints (student-interests, subscribers) are unpaginated.

---

## URL-Based Tab Navigation

Dashboard pages support deep-linking via URL parameters:
- `?tab=messages` — opens the Messages tab
- `?tab=messages&thread=5` — opens a specific thread
- Tab switches update the URL via `history.replaceState` for browser back/forward support.

---

## Notification Tiers

| Preference | Trigger | Recipients |
|---|---|---|
| **Anonymous subscriber** | Faculty becomes available | Email to subscribed visitors |
| **Student: `all`** | Any status/availability change | Email to student |
| **Student: `available`** | Faculty becomes available only | Email to student |
| **Student: `none`** | — | No notifications |

---

## Notes

1. All timestamps are UTC (ISO 8601)
2. JWT access tokens expire after **5 hours** (configurable in settings)
3. Media files served from `/media/`
4. File uploads use `multipart/form-data`
5. CORS is open in `DEBUG=True` mode; restricted to `CORS_ALLOWED_ORIGINS` in production
6. QR codes auto-detect LAN IP — no manual configuration needed for mobile testing
7. All email notifications are sent asynchronously via background threads (non-blocking)
8. Chat thread deletion is per-user (soft delete). Threads are hard-deleted only when both parties delete.
9. `duration_seconds` replaced the legacy `duration_minutes` field for broadcast messages
10. **Admin is a privilege, not a role.** The `ADMIN` role has been removed. Admin access is controlled by `is_staff` (boolean). Any user with any role (or no role) can be an admin.
11. **`is_banned` is separate from `is_active`.** Banning sets both `is_banned=True` and `is_active=False`. Deactivation only sets `is_active=False`. Unban restores both.
12. **Empty role (`""`)** means the user has no dashboard role (admin-only). They are redirected to the admin panel on login.
13. **Student ID is not required at registration.** Students are prompted to enter their ID on first dashboard visit via a blocking modal.
14. **Last-admin protection:** The system prevents removing admin privileges from the last remaining admin.
