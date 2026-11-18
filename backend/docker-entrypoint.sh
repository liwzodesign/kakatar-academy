#!/bin/sh
# Point d'entrée des conteneurs backend / celery.
# RUN_MIGRATIONS=1 (service « backend » uniquement) applique les migrations et collecte les statiques.
set -e

echo "Attente de la base de données..."
python - <<'PY'
import os, sys, time
import django
django.setup()
from django.db import connection
for attempt in range(60):
    try:
        connection.ensure_connection()
        sys.exit(0)
    except Exception as exc:  # base pas encore prête
        print(f"  ({attempt + 1}/60) {exc.__class__.__name__}, nouvelle tentative...")
        time.sleep(2)
sys.exit("Base de données injoignable")
PY

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "Migrations..."
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput

  # Superutilisateur créé uniquement si les variables sont fournies (jamais de mot de passe par défaut)
  if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py shell -c "
from users.models import User
import os
email = os.environ['DJANGO_SUPERUSER_EMAIL']
if not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, password=os.environ['DJANGO_SUPERUSER_PASSWORD'], first_name='Admin', last_name='Kakatar')
    print('Superutilisateur créé :', email)
"
  fi
fi

exec "$@"
