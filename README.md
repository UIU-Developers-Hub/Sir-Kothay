# [Sir Kothay?](https://sirkothay.pythonanywhere.com/)

> *"Sir Kothay?"* — a real-time availability broadcasting platform for universities. Faculty members share their live status via a unique URL and QR code. Students track their favourite faculty, chat directly, and get notified when a professor becomes available. Visitors can scan a QR code to instantly see where someone is and send anonymous messages.

Built with **Django REST Framework** (backend API) and a **static HTML + Tailwind CSS** client. Deployable to **PythonAnywhere** or any WSGI host.

---

## ✨ Features

### Broadcasting & Status
- **Live Broadcast Status** — set a message visible to anyone who scans your QR code or visits your page
- **Timed Statuses** — schedule a status to go live later, or auto-expire after a set duration
- **Fallback Status** — default message and default availability automatically restored when a timed status expires
- **Availability Toggle** — mark yourself Available/Unavailable; subscribers and students get notified on change
- **Set Availability on Broadcast** — each status, template, schedule, or calendar event can toggle availability automatically

### Scheduling & Automation
- **Recurring Schedules** — auto-broadcast on a weekly schedule (e.g. "Office Hours Mon 2–4 PM")
- **Calendar Events** — one-off or recurring events with broadcast integration (auto-set status during event)
  - Supports `daily`, `weekly`, `monthly` recurrence and all-day events
- **Quick Status Templates** — one-tap presets for common statuses ("In a Meeting", "Lab 401") with custom sort order
- **Automated Scheduler** — `python manage.py process_schedules` processes all triggers (cron/task)

### Role-Based Dashboards
- **Faculty Dashboard** — full broadcast management, QR codes, analytics, scheduling, unified chat inbox
- **Student Dashboard** — faculty interest tracking, threaded chat, granular notification preferences
  - **Mandatory Student ID** — students are prompted to enter their ID on first login (blocking modal)
- **Admin Dashboard** — granular user management panel:
  - **Ban / Unban** — block login (distinct from deactivation)
  - **Deactivate / Activate** — toggle account active state
  - **Toggle Admin** — grant/revoke `is_staff` privilege (last-admin protected)
  - **Toggle Verification** — manually verify or unverify a user's email
  - **Reset Password** — generate a random password or set a custom one and email it to the user
  - **Change Role** — switch between Faculty, Student, or None (admin-only) with modal UI
  - **User Detail Panel** — slide-over panel with full user info and all actions
  - **Filters & Sorting** — filter by role (Faculty/Student/None) and status (Active/Deactivated/Banned); sort by all columns
- **Admin-only users** — users with no role (`""`) and `is_staff=True` are redirected directly to the admin panel

### Communication
- **Threaded Chat System** — registered students and faculty can have multi-message, persistent conversations
  - **Thread Lifecycle** — Awaiting → Open → Closed status flow
  - **Chat Actions** — accept, reply, close, delete (per-user soft-delete)
  - **Close & Delete All** — bulk action to clean up all threads
  - **Students can follow up** in pending threads before faculty accepts
  - **Auto-Close Stale Chats** — `close_stale_chats` command auto-closes inactive threads based on faculty `auto_close_hours` setting
- **Chat Notification Preferences** — per-faculty settings:
  - `notify_new_chats` — email on new chat thread
  - `notify_chat_replies` — email on each reply
  - `notify_chat_closed` — email when a thread is closed
- **Visitor Direct Messages** — anonymous visitors can send messages from the broadcast page (no login required)
  - **Sender Verification** — inbox cross-references visitor emails with registered users (shows student ID, role)
  - **Multi-Reply Threading** — faculty can reply multiple times (append-only conversation)
- **Faculty Inbox** — unified split-panel view for both student chats and visitor DMs
- **Email Notifications** — all chat lifecycle events (new thread, acceptance, reply, close) trigger async email notifications

### Profile & Identity
- **Email Verification** — secure OTP (10-minute expiry) and link-based email verification gate required for dashboard access
- **Password Reset** — end-to-end forgot password flow via secure email tokens
- **Profile Editor** — update display name, email, designation, organization, bio, phone number, and profile image
- **Public URL Slugs** — auto-generated URL-safe slugs for broadcast pages (auto-syncs when username changes)
- **Profile Image Upload** — upload and manage profile photos

### Notification System
- **Anonymous Subscribers** — visitors subscribe via email; notified when broadcaster becomes available
- **Student Notification Preferences** — 3-tier YouTube-style bell dropdown per faculty:
  - 🔔 **All** — notified on every status/availability update
  - 🔔 **When Available** — notified only when faculty becomes available
  - 🔕 **Off** — no notifications
- **Async Email Delivery** — all emails sent via background threads (non-blocking, no Celery required)

### Analytics
- **Page View Tracking** — daily page views and QR scan counts
- **Subscriber Management** — view and manage email subscribers
- **Self-Visit Filtering** — broadcaster's own visits are not counted

### Other
- **About Page** — dynamic contributor list fetched live from the GitHub API
- **Django Admin Panel** — built-in Django admin at `/admin/` for direct database management

### QR Code
- **Auto-generated QR Codes** — encodes the public broadcast page URL
- **LAN-aware** — auto-detects your PC's LAN IP for mobile testing on the same Wi-Fi
- **Branded Center Logo** — optional logo overlay in the QR code center
- **Download Options** — download QR only, or QR with user info card

---

## 🏗 Project Structure

```
Sir-Kothay/
├── client/                          # Static frontend (HTML + Tailwind CSS + JS)
│   ├── index.html                   # Landing page
│   ├── about.html                   # About page with contributors
│   ├── base.html                    # Shared layout template
│   ├── auth/
│   │   ├── login.html               # Login (email or student ID)
│   │   └── register.html            # Register (Faculty / Student)
│   ├── broadcast/
│   │   └── message.html             # Public broadcast viewer (QR landing)
│   ├── dashboard/
│   │   ├── home.html                # Faculty dashboard (tabs: status, QR, schedule, chat, analytics)
│   │   ├── student.html             # Student dashboard (faculty tracking, chat)
│   │   ├── admin.html               # Admin dashboard (user management)
│   │   └── profile.html             # Profile editor (shared)
│   └── static/
│       ├── css/
│       ├── images/
│       └── js/
│           ├── api-config.js          # API base URL + endpoint constants
│           ├── dashboard-core.js      # Faculty: auth, profile, QR, broadcast, DM inbox
│           ├── dashboard-chat.js      # Faculty: split-panel unified chat UI
│           ├── dashboard-templates.js # Faculty: quick status templates
│           ├── dashboard-schedules.js # Faculty: recurring schedules
│           ├── dashboard-calendar.js  # Faculty: calendar events
│           ├── dashboard-inbox.js     # Faculty: legacy visitor DM inbox
│           ├── dashboard-analytics.js # Faculty: analytics charts
│           ├── student-dashboard.js   # Student: faculty cards, interest management
│           ├── student-chat.js        # Student: split-panel chat with faculty
│           ├── admin-dashboard.js     # Admin: user management
│           ├── notify-modal.js        # Notification/confirm modals (skNotify, skConfirm)
│           └── sk-modal.js            # Reusable modal component
├── server/                          # Django backend
│   ├── core/                        # Django project settings & URLs
│   ├── authApp/                     # Custom user model (Faculty/Student), JWT auth, is_staff admin
│   ├── dashboard/                   # User profile, student interests, admin management
│   ├── broadcast/                   # Broadcast messages (CRUD + public endpoint + scheduling)
│   ├── qrcodeApp/                   # QR code generation & serving
│   ├── messaging/                   # Visitor DMs + threaded chat system
│   ├── notifications/               # Email subscriber system + student notification service
│   ├── scheduler/                   # Recurring schedules, calendar events, templates, analytics
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example                 # Environment variable template
│   └── db.sqlite3                   # (gitignored) local dev database
├── scripts/
│   ├── run-local.ps1                # Windows quick-start script
│   └── run-local.sh                 # Linux/macOS quick-start script
├── API_DOCUMENTATION.md
└── README.md
```

---

## 🚀 Run Locally

### 1. Backend (Django API)

**Quick start (Windows):**
```powershell
.\scripts\run-local.ps1
```

**Manual setup:**
```bash
cd server
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Edit values as needed (see below)
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend (Static HTML)

Serve the `client/` directory over HTTP. Options:

- **VS Code Live Server** — open `client/` folder, right-click `index.html` → "Open with Live Server"
- **Python** — `python -m http.server 5500 --bind 0.0.0.0` from the `client/` folder

The client auto-detects the API URL from the hostname it's served on (`api-config.js`). If served from `192.168.x.x:5500`, API calls go to `192.168.x.x:8000`.

### 3. Mobile Testing (LAN)

Both servers must bind to `0.0.0.0` and Windows Firewall must allow ports 5500 and 8000:
```powershell
# One-time firewall setup (run as admin):
netsh advfirewall firewall add rule name="Sir Kothay Django (8000)" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Sir Kothay Client (5500)" dir=in action=allow protocol=TCP localport=5500
```

QR codes auto-detect the LAN IP so scans from mobile devices work automatically.

### 4. Automated Scheduler

Process recurring schedules, calendar events, and expiring messages:
```bash
python manage.py process_schedules
```

Auto-close inactive chat threads:
```bash
python manage.py close_stale_chats
```

Set these up as cron jobs (Linux) or PythonAnywhere scheduled tasks for production.

### 5. Override API URL (Production)

Set `window.SIR_KOTHAY_API_BASE = 'https://your-api.example.com'` in an inline script **before** `api-config.js`.

---

## 🌍 Deployment (Production)

This project uses a split-stack architecture for production: the static frontend is hosted on Firebase Hosting, and the Django backend API is hosted on PythonAnywhere.

### 1. Frontend: Firebase Hosting
1. Install the Firebase CLI: `npm install -g firebase-tools`
2. Login and initialize:
   ```bash
   firebase login
   firebase init hosting
   ```
   * Set the public directory to `client`
   * Configure as a single-page app: **No**
   * Set up automatic builds and deploys with GitHub: **Yes** (This creates a GitHub Action to auto-deploy the frontend on push).
3. Update `client/static/js/api-config.js` or use an inline script to point `API_BASE_URL` to your live PythonAnywhere URL.
4. Deploy manually (if needed): `firebase deploy --only hosting`

### 2. Backend: PythonAnywhere (Initial Setup)
We have provided an automated script to set up a brand new PythonAnywhere server from scratch.
1. Open a **Bash Console** on PythonAnywhere.
2. Run the initial setup script:
   ```bash
   git clone https://github.com/TahsinFaiyaz30/Sir-Kothay.git
   bash Sir-Kothay/scripts/setup_pythonanywhere.sh
   ```
3. **Edit your `.env`** — open `/home/YOURUSERNAME/Sir-Kothay/server/.env` and set real values for `SECRET_KEY`, `ALLOWED_HOSTS`, `GITHUB_WEBHOOK_SECRET`, and email credentials.
4. **Create a Web App** on the PythonAnywhere **Web** tab:
   - Choose **Manual configuration** → **Python 3.10**.
   - Set **Virtualenv** path to: `/home/YOURUSERNAME/.virtualenvs/venv`
5. **Edit the WSGI file** (click the link on the Web tab). Replace the entire contents with:
   ```python
   import sys
   import os
   from dotenv import load_dotenv

   path = '/home/YOURUSERNAME/Sir-Kothay/server'
   if path not in sys.path:
       sys.path.insert(0, path)

   load_dotenv(os.path.join(path, '.env'))

   from core.wsgi import application  # noqa
   ```
6. **Add Static Files** mappings on the Web tab:

   | URL | Directory |
   |---|---|
   | `/static/` | `/home/YOURUSERNAME/Sir-Kothay/server/staticfiles` |
   | `/media/` | `/home/YOURUSERNAME/Sir-Kothay/server/media` |

7. Click the green **Reload** button at the top of the Web tab.

### 3. Auto-Deployment via GitHub Webhooks
The backend is configured to automatically pull new code, migrate the database, and restart itself whenever you push to GitHub.
1. Ensure `GITHUB_WEBHOOK_SECRET` is set in your PythonAnywhere `.env` file.
2. Go to your GitHub Repository **Settings** -> **Webhooks** -> **Add webhook**.
3. Configure the webhook:
   - **Payload URL:** `https://your-username.pythonanywhere.com/api/github-webhook/`
   - **Content type:** `application/json`
   - **Secret:** The exact same password from your `.env` file.
4. **Done!** Every `git push` will now automatically deploy both the frontend (via Firebase GitHub Actions) and the backend (via the Webhook).

---

## ⚙️ Environment Variables

All server configuration is in `server/.env`. Copy `.env.example` to `.env` and edit:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | dev fallback | Django secret key. **Must change for production.** |
| `DEBUG` | `True` | Set to `False` in production. |
| `ALLOWED_HOSTS` | `127.0.0.1,localhost` | Comma-separated allowed hosts. |
| `CORS_ALLOWED_ORIGINS` | localhost variants | Comma-separated CORS origins (only used when `DEBUG=False`). |
| `CSRF_TRUSTED_ORIGINS` | localhost variants | Comma-separated CSRF trusted origins. |
| `DB_ENGINE` | SQLite | Set to `django.db.backends.postgresql` for Postgres. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | — | PostgreSQL credentials (only when `DB_ENGINE` is set). |
| `CLIENT_PUBLIC_BASE_URL` | empty | Full URL to the client root (e.g. `http://127.0.0.1:5500`). Used for QR codes and email links. |
| `GITHUB_CONTRIBUTORS_REPO` | `UIU-Developers-Hub/Sir-Kothay` | GitHub repo for the About page contributor list. |
| `GITHUB_WEBHOOK_SECRET` | — | Shared secret for GitHub Webhook auto-deploy. **Must match** the secret in your GitHub Webhook settings. |
| `EMAIL_HOST_USER` | empty | Gmail address. When set, enables real SMTP delivery. When empty, emails print to console. |
| `EMAIL_HOST_PASSWORD` | empty | Gmail App Password (16 chars). See [setup instructions](#-email-setup). |

### 📧 Email Setup

The platform uses Gmail SMTP for free email delivery (500 emails/day):

1. **Enable 2-Step Verification** on your Google account: https://myaccount.google.com/security
2. **Generate an App Password**: https://myaccount.google.com/apppasswords
3. **Add to `.env`:**
   ```
   EMAIL_HOST_USER=yourgmail@gmail.com
   EMAIL_HOST_PASSWORD=abcdefghijklmnop
   ```

When `EMAIL_HOST_USER` is empty, Django uses the console backend (emails print to terminal — useful for development).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.1, Django REST Framework, SimpleJWT |
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JS |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (Bearer tokens), privilege-based admin (`is_staff`) |
| QR Codes | `qrcode` + `Pillow` (Python) |
| Email | Gmail SMTP via `threading.Thread` (async, non-blocking) |
| Static Files | WhiteNoise |
| Hosting | PythonAnywhere (or any WSGI host) |

---

## 📡 API Overview

See **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** for full endpoint reference.

| Group | Prefix | Auth |
|-------|--------|------|
| Authentication | `/api/auth/users/` | Public (register/login) |
| User Details | `/api/dashboard/user-details/` | JWT |
| Student Interests | `/api/dashboard/student-interests/` | JWT |
| Admin Users | `/api/dashboard/admin-users/` | JWT (staff) |
| Broadcast Messages | `/api/broadcast/messages/` | JWT |
| Public Broadcast | `/api/broadcast/<slug>/` | **Public** |
| QR Codes | `/api/qrcode/qrcodes/` | JWT |
| Direct Messaging | `/api/messaging/` | Mixed |
| Threaded Chat | `/api/messaging/chat/` | JWT |
| Notifications | `/api/notifications/` | Mixed |
| Scheduler | `/api/scheduler/` | JWT |
| Analytics | `/api/scheduler/analytics/` | Mixed |

---

## 🤝 Contributing

Contributions & feedback are welcome! Please open an issue or submit a pull request.

---

**© 2026 Sir Kothay. Made with ❤️ by [UIU Developers Hub](https://github.com/UIU-Developers-Hub)**
