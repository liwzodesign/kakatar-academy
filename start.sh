#!/bin/bash

# Script de démarrage rapide pour Kakatar Academy
# Usage: ./start.sh [dev|prod|docker]

set -e

echo "🚀 Démarrage de Kakatar Academy..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Vérifier les prérequis
check_prerequisites() {
    print_message "Vérification des prérequis..."
    
    # Vérifier Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3.11+ n'est pas installé"
        exit 1
    fi
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js n'est pas installé. Installation..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
        sudo apt-get install -y nodejs
    fi
    
    # Vérifier Docker (si mode docker)
    if [ "$1" = "docker" ]; then
        if ! command -v docker &> /dev/null; then
            print_error "Docker n'est pas installé"
            exit 1
        fi
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose n'est pas installé"
            exit 1
        fi
    fi
    
    print_message "Prérequis vérifiés ✓"
}

# Mode développement
start_dev() {
    print_header "Mode Développement"
    
    # Backend
    print_message "Démarrage du backend Django..."
    cd backend
    
    # Créer l'environnement virtuel si nécessaire
    if [ ! -d "venv" ]; then
        print_message "Création de l'environnement virtuel..."
        python3 -m venv venv
    fi
    
    # Activer l'environnement virtuel
    source venv/bin/activate
    
    # Installer les dépendances
    print_message "Installation des dépendances Python..."
    pip install -r requirements.txt
    
    # Vérifier la base de données
    print_message "Vérification de la base de données..."
    if ! python manage.py check --database default; then
        print_warning "Base de données non accessible. Vérifiez PostgreSQL."
        print_message "Vous pouvez utiliser SQLite pour le développement:"
        echo "DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}"
    fi
    
    # Migrations
    print_message "Application des migrations..."
    python manage.py migrate
    
    # Créer un superuser si nécessaire
    if ! python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print('Superuser exists' if User.objects.filter(is_superuser=True).exists() else 'No superuser')" 2>/dev/null | grep -q "Superuser exists"; then
        print_message "Création d'un superuser..."
        python manage.py createsuperuser --noinput --username admin --email admin@kakataracademy.com || true
        print_warning "Superuser créé: admin@kakataracademy.com / admin123"
    fi
    
    # Démarrer le serveur backend
    print_message "Démarrage du serveur Django sur http://localhost:8000"
    python manage.py runserver &
    BACKEND_PID=$!
    
    cd ..
    
    # Frontend
    print_message "Démarrage du frontend React..."
    cd frontend
    
    # Installer les dépendances
    print_message "Installation des dépendances Node.js..."
    npm install
    
    # Démarrer le serveur frontend
    print_message "Démarrage du serveur Vite sur http://localhost:5173"
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    
    print_message "🎉 Kakatar Academy est démarré en mode développement!"
    print_message "Backend: http://localhost:8000"
    print_message "Frontend: http://localhost:5173"
    print_message "Admin: http://localhost:8000/admin"
    print_message "GraphQL: http://localhost:8000/graphql"
    
    # Attendre l'interruption
    trap "echo 'Arrêt des serveurs...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    wait
}

# Mode production
start_prod() {
    print_header "Mode Production"
    
    print_message "Démarrage en mode production..."
    
    # Backend
    cd backend
    source venv/bin/activate
    
    # Collecter les fichiers statiques
    print_message "Collecte des fichiers statiques..."
    python manage.py collectstatic --noinput
    
    # Démarrer avec Gunicorn
    print_message "Démarrage de Gunicorn..."
    gunicorn kakatar_academy.wsgi:application --bind 0.0.0.0:8000 --workers 4 &
    BACKEND_PID=$!
    
    cd ..
    
    # Frontend
    cd frontend
    print_message "Build de l'application..."
    npm run build
    
    # Servir avec un serveur statique
    print_message "Démarrage du serveur statique..."
    npx serve -s dist -l 3000 &
    FRONTEND_PID=$!
    
    cd ..
    
    print_message "🎉 Kakatar Academy est démarré en mode production!"
    print_message "Backend: http://localhost:8000"
    print_message "Frontend: http://localhost:3000"
    
    # Attendre l'interruption
    trap "echo 'Arrêt des serveurs...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    wait
}

# Mode Docker
start_docker() {
    print_header "Mode Docker"
    
    print_message "Démarrage avec Docker Compose..."
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker n'est pas en cours d'exécution"
        exit 1
    fi
    
    # Démarrer les services
    docker-compose up -d
    
    print_message "🎉 Kakatar Academy est démarré avec Docker!"
    print_message "Frontend: http://localhost:3000"
    print_message "Backend: http://localhost:8000"
    print_message "Admin: http://localhost:8000/admin"
    print_message "GraphQL: http://localhost:8000/graphql"
    print_message "Grafana: http://localhost:3001 (admin/admin)"
    print_message "Prometheus: http://localhost:9090"
    print_message "Flower: http://localhost:5555"
    print_message "MailHog: http://localhost:8025"
    
    print_message "Pour voir les logs: docker-compose logs -f"
    print_message "Pour arrêter: docker-compose down"
}

# Menu principal
show_menu() {
    echo ""
    print_header "Menu de Démarrage"
    echo "1. Mode Développement (Recommandé pour commencer)"
    echo "2. Mode Production"
    echo "3. Mode Docker (Tous les services)"
    echo "4. Vérifier l'installation"
    echo "5. Quitter"
    echo ""
    read -p "Choisissez une option (1-5): " choice
    
    case $choice in
        1) start_dev ;;
        2) start_prod ;;
        3) start_docker ;;
        4) check_installation ;;
        5) echo "Au revoir! 👋"; exit 0 ;;
        *) echo "Option invalide"; show_menu ;;
    esac
}

# Vérifier l'installation
check_installation() {
    print_header "Vérification de l'Installation"
    
    print_message "Vérification de Python..."
    python3 --version
    
    print_message "Vérification de Node.js..."
    node --version
    npm --version
    
    print_message "Vérification de PostgreSQL..."
    if command -v psql &> /dev/null; then
        psql --version
    else
        print_warning "PostgreSQL n'est pas installé"
    fi
    
    print_message "Vérification de Redis..."
    if command -v redis-cli &> /dev/null; then
        redis-cli --version
    else
        print_warning "Redis n'est pas installé"
    fi
    
    print_message "Vérification de Docker..."
    if command -v docker &> /dev/null; then
        docker --version
        docker-compose --version
    else
        print_warning "Docker n'est pas installé"
    fi
    
    show_menu
}

# Script principal
main() {
    if [ $# -eq 0 ]; then
        show_menu
    else
        case $1 in
            "dev") check_prerequisites && start_dev ;;
            "prod") check_prerequisites && start_prod ;;
            "docker") check_prerequisites && start_docker ;;
            *) echo "Usage: $0 [dev|prod|docker]"; exit 1 ;;
        esac
    fi
}

# Exécuter le script principal
main "$@" 