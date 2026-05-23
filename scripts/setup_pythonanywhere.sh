#!/bin/bash
# First-time setup script for a brand new PythonAnywhere account
# Usage: bash Sir-Kothay/scripts/setup_pythonanywhere.sh

set -e  # Exit immediately if any command fails

echo "==============================================="
echo "Starting Initial PythonAnywhere Setup..."
echo "==============================================="

# 1. Clone the repository if it doesn't exist
if [ ! -d "$HOME/Sir-Kothay" ]; then
    echo "[1/7] Cloning repository from GitHub..."
    git clone https://github.com/TahsinFaiyaz30/Sir-Kothay.git "$HOME/Sir-Kothay"
else
    echo "[1/7] Repository already exists. Pulling latest code..."
    cd "$HOME/Sir-Kothay"
    git pull
fi

cd "$HOME/Sir-Kothay/server"

# 2. Create the .env file template if it doesn't exist
if [ ! -f "$HOME/Sir-Kothay/server/.env" ]; then
    echo "[2/7] Creating default .env file..."
    cat <<'EOT' > "$HOME/Sir-Kothay/server/.env"
# === Django Core ===
DEBUG=False
SECRET_KEY=CHANGE_ME_TO_A_LONG_RANDOM_STRING
ALLOWED_HOSTS=YOURUSERNAME.pythonanywhere.com

# === Client URL (where Firebase frontend is hosted) ===
CLIENT_PUBLIC_BASE_URL=https://sir-kothay-tahsinfaiyaz30.web.app

# === CORS & CSRF (add your Firebase URL here) ===
CORS_ALLOWED_ORIGINS=https://sir-kothay-tahsinfaiyaz30.web.app,https://sir-kothay-tahsinfaiyaz30.firebaseapp.com
CSRF_TRUSTED_ORIGINS=https://sir-kothay-tahsinfaiyaz30.web.app,https://sir-kothay-tahsinfaiyaz30.firebaseapp.com

# === GitHub Webhook Auto-Deploy ===
GITHUB_WEBHOOK_SECRET=CHANGE_ME_TO_A_SECURE_PASSWORD

# === Email (Gmail SMTP) ===
# 1. Enable 2-Step Verification: https://myaccount.google.com/security
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Paste below (no spaces)
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# === GitHub About Page (optional) ===
GITHUB_CONTRIBUTORS_REPO=UIU-Developers-Hub/Sir-Kothay
EOT
    echo ""
    echo "  ⚠️  IMPORTANT: Edit $HOME/Sir-Kothay/server/.env now!"
    echo "     - Set a real SECRET_KEY"
    echo "     - Set your ALLOWED_HOSTS to your PythonAnywhere username"
    echo "     - Set a secure GITHUB_WEBHOOK_SECRET"
    echo ""
else
    echo "[2/7] .env file already exists."
fi

# 3. Create Virtual Environment
echo "[3/7] Setting up Virtual Environment..."
if [ ! -d "$HOME/.virtualenvs/venv" ]; then
    mkdir -p "$HOME/.virtualenvs"
    python3.10 -m venv "$HOME/.virtualenvs/venv"
    echo "  -> Virtual environment created."
else
    echo "  -> Virtual environment already exists."
fi

# Absolute paths for flawless execution
VENV_PYTHON="$HOME/.virtualenvs/venv/bin/python"
VENV_PIP="$HOME/.virtualenvs/venv/bin/pip"

# 4. Install Dependencies
echo "[4/7] Installing Python dependencies..."
$VENV_PIP install --upgrade pip
$VENV_PIP install -r requirements.txt

# 5. Database Migrations
echo "[5/7] Running database migrations..."
$VENV_PYTHON manage.py migrate

# 6. Create cache table
echo "[6/7] Creating cache table..."
$VENV_PYTHON manage.py createcachetable

# 7. Collect Static Files
echo "[7/7] Collecting static files..."
$VENV_PYTHON manage.py collectstatic --noinput

# 8. Make the deploy script executable
chmod +x "$HOME/Sir-Kothay/scripts/deploy_pythonanywhere.sh"

echo ""
echo "==============================================="
echo "Setup Complete! 🎉"
echo "==============================================="
echo ""
echo "Next steps on the PythonAnywhere Web tab:"
echo "1. Create a Web App (Manual config → Python 3.10)"
echo "2. Set Virtualenv path to: $HOME/.virtualenvs/venv"
echo "3. Edit WSGI file — set:"
echo "     import sys"
echo "     path = '/home/YOURUSERNAME/Sir-Kothay/server'"
echo "     sys.path.insert(0, path)"
echo "     from core.wsgi import application"
echo "4. Static files:"
echo "     /static/  →  $HOME/Sir-Kothay/server/staticfiles"
echo "     /media/   →  $HOME/Sir-Kothay/server/media"
echo "5. Reload your Web App!"
echo ""
echo "Then edit your .env file with real secrets before going live."
