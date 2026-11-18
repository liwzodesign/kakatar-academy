#!/usr/bin/env bash
# Kakatar Academy — démarrage rapide
#   ./start.sh dev      Backend Django (8000) + frontend Vite (5173), PostgreSQL, paiements simulés
#   ./start.sh test     Tests backend + vérification TypeScript + build frontend
#   ./start.sh docker   Pile complète Docker (PostgreSQL, Redis, Celery, Nginx)
set -euo pipefail
cd "$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[ATTENTION]${NC} $*"; }
fail() { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }

PY=$(command -v python3 || command -v python || true)
[ -n "$PY" ] || fail "Python 3.11+ est requis."

venv_python() {
  if [ -x backend/.venv/bin/python ]; then echo backend/.venv/bin/python; else echo backend/.venv/Scripts/python; fi
}

setup_backend() {
  if [ -z "${DATABASE_URL:-}" ] && ! grep -qs '^DATABASE_URL=postgres' backend/.env; then
    fail "PostgreSQL requis : ajoutez DATABASE_URL=postgres://user:motdepasse@localhost:5432/kakatar_academy dans backend/.env"
  fi
  if [ ! -d backend/.venv ]; then
    info "Création de l'environnement virtuel Python..."
    "$PY" -m venv backend/.venv
  fi
  local vpy; vpy=$(venv_python)
  info "Installation des dépendances Python..."
  "$vpy" -m pip install -q --upgrade pip
  "$vpy" -m pip install -q -r backend/requirements.txt
  (cd backend && "../$vpy" manage.py migrate --noinput)
}

setup_frontend() {
  command -v npm >/dev/null || fail "Node.js 18+ est requis."
  [ -d node_modules ] || { info "Installation des dépendances npm..."; npm install; }
}

start_dev() {
  setup_backend
  setup_frontend
  local vpy; vpy=$(venv_python)
  if [ "${SEED:-1}" = "1" ]; then
    (cd backend && "../$vpy" manage.py seed_demo) || warn "Seed ignoré"
  fi
  info "Backend : http://localhost:8000  (admin : /admin/, GraphQL : /graphql/)"
  (cd backend && "../$vpy" manage.py runserver 8000) &
  BACK=$!
  trap 'kill $BACK 2>/dev/null' EXIT INT TERM
  info "Frontend : http://localhost:5173"
  npm run dev
}

run_tests() {
  setup_backend
  setup_frontend
  local vpy; vpy=$(venv_python)
  (cd backend && "../$vpy" -m pytest)
  npx tsc --noEmit -p tsconfig.app.json
  npm run lint
  npm run build
  info "Tout est vert ✅"
}

start_docker() {
  command -v docker >/dev/null || fail "Docker est requis."
  [ -f .env ] || { cp .env.example .env; warn "Fichier .env créé depuis .env.example : renseignez SECRET_KEY et POSTGRES_PASSWORD puis relancez."; exit 1; }
  docker compose up -d --build
  info "Application : http://localhost  — logs : docker compose logs -f backend"
}

case "${1:-}" in
  dev) start_dev ;;
  test) run_tests ;;
  docker) start_docker ;;
  *) echo "Usage : $0 {dev|test|docker}"; exit 1 ;;
esac
