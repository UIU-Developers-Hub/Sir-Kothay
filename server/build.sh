#!/usr/bin/env bash
set -Eeuo pipefail

python -m pip install -r requirements.txt

# Never deploy model changes that are missing a committed migration.
python manage.py makemigrations --check --no-input

python manage.py collectstatic --no-input

# Render runs this build script for both the first deploy and every redeploy.
# A migration error aborts the deploy and leaves the previous release online.
python manage.py migrate --no-input
python manage.py createcachetable
