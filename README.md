# [Sir Kothay?](https://sirkothay.pythonanywhere.com/)

> *"Sir Kothay?"* — a real-time availability broadcasting platform. Professors, TAs, and professionals can share their live status via a unique URL and QR code. Visitors scan the QR code to instantly see where someone is, send direct messages, and subscribe for availability notifications.

Built with **Django REST Framework** (backend API) and a **static HTML + Tailwind CSS** client. Deployable to **PythonAnywhere** or any WSGI host.

---

## ✨ Features

### Broadcasting & Status
- **Live Broadcast Status** — set a message visible to anyone who scans your QR code or visits your page
- **Timed Statuses** — schedule a status to go live later, or auto-expire after a set duration
- **Fallback Status** — default message automatically restored when a timed status expires
- **Availability Toggle** — mark yourself Available/Unavailable; subscribers get notified on change

### Scheduling & Automation
- **Recurring Schedules** — auto-broadcast on a weekly schedule (e.g. "Office Hours Mon 2–4 PM")
- **Calendar Events** — one-off events with broadcast integration (auto-set status during event)
- **Quick Status Templates** — one-tap presets for common statuses ("In a Meeting", "Lab 401")
- **Automated Scheduler** — `python manage.py process_schedules` processes all triggers (cron/task)

### Communication
- **Visitor Direct Messages** — visitors can send messages from the broadcast page (no login required)
- **Broadcaster Inbox** — view and reply to visitor messages from the dashboard
- **Email Notifications** — subscribers get emailed when a broadcaster becomes available

### Analytics
- **Page View Tracking** — daily page views and QR scan counts
- **Subscriber Management** — view and manage email subscribers
- **Self-Visit Filtering** — broadcaster's own visits are not counted

### QR Code
- **Auto-generated QR Codes** — encodes the public broadcast page URL
- **LAN-aware** — auto-detects your PC's LAN IP for mobile testing on the same Wi-Fi
- **Branded Center Logo** — optional logo overlay in the QR code center
- **Download Options** — download QR only, or QR with user info card

---

## 🏗 Project Structure

```
Sir-Kothay/
├── client/                     # Static frontend (HTML + Tailwind CSS + JS)
│   ├── index.html              # Landing page
│   ├── about.html              # About page
│   ├── auth/                   # Login & Register pages
│   ├── broadcast/              # Public broadcast viewer (QR landing)
│   ├── dashboard/              # Authenticated dashboard & profile
│   └── static/
│       ├── css/
│       ├── images/
│       └── js/
│           ├── api-config.js           # API base URL (auto-detects LAN IP)
│           ├── dashboard-core.js       # Auth, profile, QR, broadcast
│           ├── dashboard-templates.js  # Quick status templates
│           ├── dashboard-schedules.js  # Recurring schedules
│           ├── dashboard-calendar.js   # Calendar events
│           ├── dashboard-inbox.js      # Visitor messages
│           └── dashboard-analytics.js  # Analytics tab
├── server/                     # Django backend
│   ├── core/                   # Django project settings & URLs
│   ├── authApp/                # Custom user model, JWT auth
│   ├── dashboard/              # User profile / details
│   ├── broadcast/              # Broadcast messages (CRUD + public endpoint)
│   ├── qrcodeApp/              # QR code generation & serving
│   ├── messaging/              # Visitor → Broadcaster direct messages
│   ├── notifications/          # Email subscriber system
│   ├── scheduler/              # Recurring, calendar, templates, analytics
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── db.sqlite3              # (gitignored) local dev database
├── scripts/
│   ├── run-local.ps1           # Windows quick-start script
│   └── run-local.sh            # Linux/macOS quick-start script
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
cp .env.example .env          # Edit SECRET_KEY for non-local use
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
Set this up as a cron job (Linux) or PythonAnywhere scheduled task for production.

### 5. Override API URL (Production)

Set `window.SIR_KOTHAY_API_BASE = 'https://your-api.example.com'` in an inline script **before** `api-config.js`.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.1, Django REST Framework, SimpleJWT |
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JS |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (Bearer tokens) |
| QR Codes | `qrcode` + `Pillow` (Python) |
| Hosting | PythonAnywhere (or any WSGI host) |

---

## 📡 API Overview

See **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** for full endpoint reference.

| Group | Prefix | Auth |
|-------|--------|------|
| Authentication | `/api/auth/users/` | Public (register/login) |
| User Details | `/api/dashboard/user-details/` | JWT |
| Broadcast Messages | `/api/broadcast/messages/` | JWT |
| Public Broadcast | `/api/broadcast/<slug>/` | **Public** |
| QR Codes | `/api/qrcode/qrcodes/` | JWT |
| Direct Messaging | `/api/messaging/` | Mixed |
| Notifications | `/api/notifications/` | Mixed |
| Scheduler | `/api/scheduler/` | JWT |
| Analytics | `/api/scheduler/analytics/` | Mixed |

---

## 🤝 Contributing

Contributions & feedback are welcome! Please open an issue or submit a pull request.

---

**© 2026 Sir Kothay. Made with ❤️ by [UIU Developers Hub](https://github.com/UIU-Developers-Hub)**
