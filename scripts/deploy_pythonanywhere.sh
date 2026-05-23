#!/bin/bash
# Master Script for Sir-Kothay PythonAnywhere
# Handles both interactive initial setup and silent background auto-deploy.

set -e

REPO_DIR="$HOME/Sir-Kothay"
LOGFILE="$REPO_DIR/deploy.log"
VENV_DIR="$HOME/.virtualenvs/venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"
ENV_FILE="$REPO_DIR/server/.env"
ENV_EXAMPLE="$REPO_DIR/server/.env.example"

# 1. Determine if running interactively
INTERACTIVE=false
if [ -t 0 ]; then
    INTERACTIVE=true
fi

log() {
    # Print to console if interactive, always log to file
    if [ "$INTERACTIVE" = true ]; then
        echo "$1"
    fi
    # Only write to logfile if the directory exists
    if [ -d "$REPO_DIR" ]; then
        echo "$1" >> "$LOGFILE"
    fi
}

log "==============================================="
log "Process started at $(date)"
log "==============================================="

# 2. Clone repo if missing
if [ ! -d "$REPO_DIR" ]; then
    log "[+] Cloning repository..."
    git clone https://github.com/TahsinFaiyaz30/Sir-Kothay.git "$REPO_DIR" >> "$LOGFILE" 2>&1
fi

cd "$REPO_DIR" || { log "FATAL: project dir missing"; exit 1; }

# 3. Pull latest code
log "[+] Pulling latest code..."
git fetch --all >> "$LOGFILE" 2>&1
git reset --hard origin/main >> "$LOGFILE" 2>&1

cd server || { log "FATAL: server dir missing"; exit 1; }

# 4. Interactive .env Setup/Update
if [ "$INTERACTIVE" = true ]; then
    log "[+] Checking .env configuration..."
    NEEDS_EDIT=false

    # If .env doesn't exist at all, seed it from .env.example
    if [ ! -f "$ENV_FILE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log "  -> Created .env from .env.example template."
        NEEDS_EDIT=true
    else
        # Check for any missing keys and append them
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ -z "$line" || "$line" == \#* ]]; then continue; fi
            key=$(echo "$line" | cut -d '=' -f 1)
            if ! grep -q "^${key}=" "$ENV_FILE"; then
                echo "" >> "$ENV_FILE"
                echo "# NEW — added from .env.example" >> "$ENV_FILE"
                echo "$line" >> "$ENV_FILE"
                NEEDS_EDIT=true
                log "  -> New key added: $key (edit the value below)"
            fi
        done < "$ENV_EXAMPLE"
    fi

    # Ask about database if not configured
    if ! grep -q "^DB_ENGINE=" "$ENV_FILE"; then
        read -p "Are you using SQLite? (y/n) [default: y]: " is_sqlite
        if [[ "$is_sqlite" =~ ^[Nn] ]]; then
            cat <<'DBEOF' >> "$ENV_FILE"

# Database (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=sirkothay_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DBEOF
            NEEDS_EDIT=true
            log "  -> PostgreSQL config added. Edit the values below."
        fi
    fi

    # Open nano for the user to review/edit all values
    if [ "$NEEDS_EDIT" = true ]; then
        echo ""
        echo "╔══════════════════════════════════════════════════════╗"
        echo "║  📝 Opening .env in nano for you to edit.            ║"
        echo "║  Replace ALL placeholder values with real ones.      ║"
        echo "║  Save: Ctrl+X → Y → Enter                           ║"
        echo "╚══════════════════════════════════════════════════════╝"
        echo ""
        nano "$ENV_FILE"
    else
        echo "  -> All env keys present. Skipping editor."
        read -p "  Open .env in nano anyway to review? (y/n) [default: n]: " open_anyway
        if [[ "$open_anyway" =~ ^[Yy] ]]; then
            nano "$ENV_FILE"
        fi
    fi

    # Validate: check for placeholder values that weren't changed
    echo ""
    WARNINGS=0
    PLACEHOLDERS="CHANGE_ME change-me your-gmail your_db_user your_db_password YOURUSERNAME"
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ -z "$line" || "$line" == \#* ]]; then continue; fi
        key=$(echo "$line" | cut -d '=' -f 1)
        val=$(echo "$line" | cut -d '=' -f 2-)
        for placeholder in $PLACEHOLDERS; do
            if echo "$val" | grep -qi "$placeholder"; then
                echo "  ⚠️  WARNING: $key still has a placeholder value!"
                WARNINGS=$((WARNINGS + 1))
                break
            fi
        done
    done < "$ENV_FILE"

    if [ "$WARNINGS" -gt 0 ]; then
        echo ""
        echo "  ⚠️  $WARNINGS variable(s) still have placeholder values."
        read -p "  Re-open .env to fix? (y/n) [default: y]: " reopen
        if [[ ! "$reopen" =~ ^[Nn] ]]; then
            nano "$ENV_FILE"
        fi
    else
        echo "  ✅ All env variables look good!"
    fi
else
    # Background mode: check for encrypted env values from pre-commit hook
    DEPLOY_ENC="$REPO_DIR/.env.deploy.enc"
    if [ -f "$DEPLOY_ENC" ]; then
        # Read the webhook secret from current .env to decrypt
        WEBHOOK_SECRET=$(grep "^GITHUB_WEBHOOK_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f 2-)
        if [ -n "$WEBHOOK_SECRET" ]; then
            log "[+] Found encrypted env values from commit. Decrypting..."
            DECRYPTED=$(openssl enc -aes-256-cbc -pbkdf2 -d -salt -pass "pass:${WEBHOOK_SECRET}" -in "$DEPLOY_ENC" 2>/dev/null) || true
            if [ -n "$DECRYPTED" ]; then
                while IFS= read -r line; do
                    if [ -z "$line" ]; then continue; fi
                    key=$(echo "$line" | cut -d '=' -f 1)
                    if grep -q "^${key}=" "$ENV_FILE"; then
                        # Update existing key
                        sed -i "s|^${key}=.*|${line}|" "$ENV_FILE"
                        log "  ✅ UPDATED: ${key}"
                    else
                        # Add new key
                        echo "$line" >> "$ENV_FILE"
                        log "  ✅ ADDED: ${key}"
                    fi
                done <<< "$DECRYPTED"
            fi
        fi
        # Remove the encrypted file from git so it doesn't persist
        rm -f "$DEPLOY_ENC"
        cd "$REPO_DIR" && git add -A ".env.deploy.enc" && git commit -m "chore: consumed env deploy payload" --no-verify >> "$LOGFILE" 2>&1 || true
        cd "$REPO_DIR/server"
    fi

    # Fallback: auto-fill any remaining missing keys from .env.example with defaults
    if [ -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
        ADDED_KEYS=""
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ -z "$line" || "$line" == \#* ]]; then continue; fi
            key=$(echo "$line" | cut -d '=' -f 1)
            default_val=$(echo "$line" | cut -d '=' -f 2-)
            if ! grep -q "^${key}=" "$ENV_FILE"; then
                echo "${key}=${default_val}" >> "$ENV_FILE"
                ADDED_KEYS="${ADDED_KEYS}  ⚠️  FALLBACK: ${key}=${default_val}\n"
            fi
        done < "$ENV_EXAMPLE"
        if [ -n "$ADDED_KEYS" ]; then
            log "WARNING: Some env vars used .env.example defaults (no encrypted values provided):"
            log "$(echo -e "$ADDED_KEYS")"
        fi
    fi
fi

# 5. Virtual Environment
log "[+] Checking Virtual Environment..."
if [ ! -d "$VENV_DIR" ]; then
    mkdir -p "$HOME/.virtualenvs"
    python3.10 -m venv "$VENV_DIR" >> "$LOGFILE" 2>&1
    log "  -> Virtual environment created."
fi

# 6. Install dependencies
log "[+] Installing Python dependencies..."
$VENV_PIP install --upgrade pip >> "$LOGFILE" 2>&1
$VENV_PIP install -r requirements.txt >> "$LOGFILE" 2>&1

# 7. Database Migrations
log "[+] Running migrations..."
$VENV_PYTHON manage.py migrate >> "$LOGFILE" 2>&1
$VENV_PYTHON manage.py createcachetable >> "$LOGFILE" 2>&1 || true

# 8. Collect Static Files
log "[+] Collecting static files..."
$VENV_PYTHON manage.py collectstatic --noinput >> "$LOGFILE" 2>&1

# 9. Reload WSGI
log "[+] Restarting WSGI server..."
# Find the wsgi file dynamically based on username
USERNAME_LOWER=$(whoami | tr '[:upper:]' '[:lower:]')
WSGI_FILE="/var/www/${USERNAME_LOWER}_pythonanywhere_com_wsgi.py"
if [ -f "$WSGI_FILE" ]; then
    touch "$WSGI_FILE"
else
    # Fallback to the known TahsinFaiyaz30 username just in case
    if [ -f "/var/www/tahsinfaiyaz30_pythonanywhere_com_wsgi.py" ]; then
        touch "/var/www/tahsinfaiyaz30_pythonanywhere_com_wsgi.py"
    fi
fi

log "Process finished at $(date)"
log "==============================================="
