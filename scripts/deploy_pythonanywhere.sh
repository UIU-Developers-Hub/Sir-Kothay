#!/bin/bash
# Auto-deploy script — triggered by GitHub Webhook after every push.
# Pulls latest code, installs deps, migrates DB, collects static, and restarts.

set -e  # Exit immediately if any command fails

LOGFILE="/home/TahsinFaiyaz30/Sir-Kothay/deploy.log"
VENV_PYTHON="/home/TahsinFaiyaz30/.virtualenvs/venv/bin/python"
VENV_PIP="/home/TahsinFaiyaz30/.virtualenvs/venv/bin/pip"

echo "===============================================" >> "$LOGFILE"
echo "Deployment started at $(date)" >> "$LOGFILE"

# Navigate to project root
cd /home/TahsinFaiyaz30/Sir-Kothay || { echo "FATAL: project dir missing" >> "$LOGFILE"; exit 1; }

# Pull the latest code (hard reset to match GitHub exactly)
git fetch --all >> "$LOGFILE" 2>&1
git reset --hard origin/main >> "$LOGFILE" 2>&1

# Navigate to server
cd server || { echo "FATAL: server dir missing" >> "$LOGFILE"; exit 1; }

# Install any new/changed dependencies
$VENV_PIP install -r requirements.txt >> "$LOGFILE" 2>&1

# Run database migrations
$VENV_PYTHON manage.py migrate >> "$LOGFILE" 2>&1

# Collect static files
$VENV_PYTHON manage.py collectstatic --noinput >> "$LOGFILE" 2>&1

# Reload PythonAnywhere WSGI server
echo "Restarting WSGI server..." >> "$LOGFILE"
touch /var/www/tahsinfaiyaz30_pythonanywhere_com_wsgi.py

echo "Deployment finished at $(date)" >> "$LOGFILE"
echo "===============================================" >> "$LOGFILE"
