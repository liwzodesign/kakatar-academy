#!/bin/sh
# Point d'entrée du backend Kakatar Academy
set -e

if [ -n "$DB_HOST" ]; then
  echo "Attente de PostgreSQL ($DB_HOST:${DB_PORT:-5432})..."
  while ! nc -z "$DB_HOST" "${DB_PORT:-5432}"; do sleep 1; done
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Superutilisateur initial optionnel (DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD)
if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput \
    --email "$DJANGO_SUPERUSER_EMAIL" \
    --first_name "${DJANGO_SUPERUSER_FIRST_NAME:-Admin}" \
    --last_name "${DJANGO_SUPERUSER_LAST_NAME:-Kakatar}" 2>/dev/null || true
fi

exec "$@"
