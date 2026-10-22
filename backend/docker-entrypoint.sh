#!/bin/bash

# Script d'entrée Docker pour Kakatar Academy Backend

set -e

# Attendre que la base de données soit prête
echo "Attente de la base de données..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "Base de données prête!"

# Attendre que Redis soit prêt
echo "Attente de Redis..."
while ! nc -z redis 6379; do
  sleep 1
done
echo "Redis prêt!"

# Attendre qu'Elasticsearch soit prêt
echo "Attente d'Elasticsearch..."
while ! curl -s http://elasticsearch:9200 > /dev/null; do
  sleep 5
done
echo "Elasticsearch prêt!"

# Appliquer les migrations
echo "Application des migrations..."
python manage.py migrate --noinput

# Collecter les fichiers statiques
echo "Collecte des fichiers statiques..."
python manage.py collectstatic --noinput

# Créer un superuser si nécessaire
echo "Vérification du superuser..."
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser(
        'admin@kakataracademy.com',
        'admin123',
        first_name='Admin',
        last_name='Kakatar'
    )
    print('Superuser créé: admin@kakataracademy.com / admin123')
else:
    print('Superuser existe déjà')
EOF

# Indexer Elasticsearch si nécessaire
echo "Indexation Elasticsearch..."
python manage.py search_index --rebuild --noinput

# Démarrer l'application
echo "Démarrage de l'application..."
exec "$@" 