# Sir-Kothay REST API Documentation

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
{ "email": "user@example.com", "username": "username", "password": "password123" }
```
**Response:** `201` — user object + `tokens.access` / `tokens.refresh`

---

### 1.2 Login
**POST** `/api/auth/users/login/`

```json
{ "email": "user@example.com", "password": "password123" }
```
**Response:** `200` — user object + tokens

---

### 1.3 Get Current User
**GET** `/api/auth/users/me/` · 🔒 JWT

**Response:** user object (id, email, username, first_name, last_name, is_active, date_joined)

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

**Response:**
```json
{
  "id": 1, "user": 1,
  "user_email": "user@example.com",
  "user_username": "username",
  "profile_image": "/media/profile_images/photo.jpg",
  "phone_number": "01XXXXXXXXX",
  "bio": "...", "designation": "...", "organization": "...",
  "default_status": "Away from desk",
  "is_available": true,
  "slug": "username-1"
}
```

---

### 2.2 Update My Details
**PATCH** `/api/dashboard/user-details/update_my_details/` · 🔒 JWT

Accepts any subset of: `phone_number`, `bio`, `designation`, `organization`, `default_status`, `is_available`, `profile_image` (multipart).

---

### 2.3 List All User Details
**GET** `/api/dashboard/user-details/` · 🔒 JWT · Paginated

---

## 3 · Broadcast Messages

### 3.1 List My Messages
**GET** `/api/broadcast/messages/my_messages/` · 🔒 JWT

**Response:** array of message objects:
```json
[
  {
    "id": 1, "user": 1,
    "message": "In Room 405",
    "active": true,
    "scheduled_for": null,
    "duration_minutes": 60,
    "active_until": "2026-05-18T13:00:00Z",
    "created_at": "2026-05-18T12:00:00Z"
  }
]
```

---

### 3.2 Get Active Message
**GET** `/api/broadcast/messages/active_message/` · 🔒 JWT

---

### 3.3 Create Message
**POST** `/api/broadcast/messages/` · 🔒 JWT

```json
{
  "message": "In Room 405 until 3pm",
  "active": true,
  "scheduled_for": null,
  "duration_minutes": 60
}
```

---

### 3.4 Update Message
**PATCH** `/api/broadcast/messages/{id}/` · 🔒 JWT

---

### 3.5 Delete Message
**DELETE** `/api/broadcast/messages/{id}/` · 🔒 JWT · `204 No Content`

---

### 3.6 Toggle Active (Set Active)
**POST** `/api/broadcast/messages/{id}/set_active/` · 🔒 JWT

Deactivates all other messages and activates the specified one.

---

### 3.7 Public Broadcast (No Auth)
**GET** `/api/broadcast/<user_slug>/` · 🌐 Public

Returns user profile + active broadcast message for the public broadcast page and QR code scanning.

**Response:**
```json
{
  "username": "username",
  "email": "user@example.com",
  "phone_number": "01XXXXXXXXX",
  "organization": "UIU",
  "designation": "Lecturer",
  "bio": "...",
  "profile_image": "/media/profile_images/photo.jpg",
  "active_message": "In Room 405 until 3pm",
  "is_available": true,
  "slug": "username-1"
}
```

---

## 4 · QR Code

### 4.1 Get My QR Code
**GET** `/api/qrcode/qrcodes/my_qrcode/` · 🔒 JWT

**Response:**
```json
{
  "id": 1, "user": 1,
  "image": "/media/qr_codes/qr_1_username.png",
  "generated_at": "2026-05-18T12:00:00Z"
}
```

---

### 4.2 Generate / Regenerate QR Code
**POST** `/api/qrcode/qrcodes/generate/` · 🔒 JWT

Generates a QR code encoding the user's public broadcast URL. Auto-detects LAN IP for mobile access.

**Response:**
```json
{
  "message": "QR code generated successfully",
  "qr_code": { "id": 1, "image": "/media/qr_codes/qr_1_username.png", "..." },
  "public_profile_url": "http://192.168.1.100:5500/broadcast/message.html?user=username-1"
}
```

---

### 4.3 QR PNG Export
**GET** `/api/qrcode/qrcodes/qr_png/` · 🔒 JWT

Returns raw PNG bytes (for canvas-based exports). Set `Accept: image/png`.

---

### 4.4 Footer PNG Export
**GET** `/api/qrcode/qrcodes/footer_png/` · 🔒 JWT

Returns the branded footer PNG for "QR with user info" downloads.

---

## 5 · Direct Messaging

### 5.1 Send Message to Broadcaster (Public)
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

### 5.2 Inbox
**GET** `/api/messaging/inbox/` · 🔒 JWT

Returns all messages received by the authenticated broadcaster.

---

### 5.3 Unread Count
**GET** `/api/messaging/unread/` · 🔒 JWT

**Response:** `{ "unread_count": 3 }`

---

### 5.4 Message Detail
**GET** `/api/messaging/{id}/` · 🔒 JWT

Returns full message details and marks it as read.

---

### 5.5 Reply to Message
**POST** `/api/messaging/{id}/reply/` · 🔒 JWT

```json
{ "body": "I'll be available at 3pm." }
```

---

### 5.6 Delete Message
**DELETE** `/api/messaging/{id}/delete/` · 🔒 JWT

---

## 6 · Notifications (Subscribers)

### 6.1 Subscribe to Broadcaster (Public)
**POST** `/api/notifications/subscribe/<user_slug>/` · 🌐 Public

```json
{ "email": "subscriber@example.com" }
```

Subscribers receive an email when the broadcaster toggles to "Available".

---

### 6.2 Unsubscribe
**GET** `/api/notifications/unsubscribe/<token>/` · 🌐 Public

Token-based unsubscribe link (included in notification emails).

---

### 6.3 List My Subscribers
**GET** `/api/notifications/subscribers/` · 🔒 JWT

---

### 6.4 Remove Subscriber
**DELETE** `/api/notifications/subscribers/{id}/` · 🔒 JWT

---

## 7 · Scheduler

### 7.1 Recurring Schedules (CRUD)
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
  "time": "14:00:00",
  "message": "Office Hours — Room 405",
  "duration_minutes": 120,
  "set_available": true
}
```
`day_of_week`: 0=Monday … 6=Sunday

---

### 7.2 Calendar Events (CRUD)
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
  "start": "2026-05-20T10:00:00Z",
  "end": "2026-05-20T12:00:00Z",
  "broadcast_message": "In Faculty Meeting",
  "color": "#f68b1f",
  "set_available": false
}
```

---

### 7.3 Quick Status Templates (CRUD)
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
  "set_available": false
}
```

---

## 8 · Analytics

### 8.1 Analytics Summary
**GET** `/api/scheduler/analytics/` · 🔒 JWT

**Response:**
```json
{
  "total_views": 142,
  "total_scans": 38,
  "daily": [
    { "date": "2026-05-18", "view_count": 12, "qr_scan_count": 3 }
  ]
}
```

---

### 8.2 Track Visit
**POST** `/api/scheduler/analytics/track/` · 🌐 Public (optional JWT)

```json
{ "slug": "username-1", "source": "page" }
```
`source`: `"page"` or `"qr"`. If JWT is included, self-visits are skipped.

---

## Error Responses

| Status | Body |
|--------|------|
| `401` | `{ "detail": "Authentication credentials were not provided." }` |
| `403` | `{ "error": "Permission denied" }` |
| `404` | `{ "error": "User not found", "message": "..." }` |
| `400` | `{ "field_name": ["Error message"] }` |

---

## Pagination

List endpoints return paginated results:
```json
{ "count": 50, "next": "...?page=2", "previous": null, "results": [...] }
```
Query params: `page` (default 1), `page_size` (default 10, max 100).

---

## Notes

1. All timestamps are UTC (ISO 8601)
2. JWT access tokens expire after **5 hours** (configurable)
3. Media files served from `/media/`
4. File uploads use `multipart/form-data`
5. CORS is open in `DEBUG=True` mode for development
6. QR codes auto-detect LAN IP — no manual configuration needed for mobile testing
