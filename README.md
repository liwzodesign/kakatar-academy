# 🎓 Kakatar Academy - Plateforme d'Apprentissage Hybride

## 📋 Description

Kakatar Academy est une plateforme d'apprentissage en ligne moderne et complète, conçue pour offrir une expérience pédagogique supérieure en combinant contenu multimédia, collaboration, intelligence artificielle, outils marketing et fonctionnalités sociales.

## ✨ Fonctionnalités Principales

### 🔐 Authentification & Gestion des Utilisateurs
- **Système de rôles** : Étudiant, Formateur, Administrateur, Modérateur, Partenaire
- **Vérification des comptes formateurs** avec documents et CV
- **Authentification à deux facteurs** (MFA)
- **Gestion des profils** avec compétences et objectifs d'apprentissage

### 📚 Gestion des Cours
- **Création de cours** avec modules et leçons
- **Types de contenu** : Vidéo, Texte, Quiz, Projet, Ressource
- **Structure hiérarchique** : Cours > Modules > Leçons
- **Système de progression** et suivi des étudiants

### 💳 Système de Paiement
- **Multi-gateways** : Stripe, PayDunya, Wave, Mobile Money
- **Codes promo** et système de remises
- **Gestion des commissions** automatique pour les formateurs
- **Abonnements** et paiements récurrents

### 🎥 Gestion Vidéo
- **Streaming HLS/DASH** avec CDN
- **Upload sécurisé** vers S3/Cloudflare R2
- **Sous-titrage automatique** via IA
- **Mode hors-ligne** chiffré

### 🤖 Services IA
- **Recommandations de cours** basées sur l'IA
- **Génération automatique de quiz**
- **Résumés automatiques** des leçons
- **Modération automatique** du contenu

### 🏪 Marketplace
- **Vente de ressources** (templates, fichiers source)
- **Services de coaching** et prestations
- **Gestion des livraisons** numériques

### 📊 Analytics & Reporting
- **Dashboard complet** pour formateurs et administrateurs
- **Métriques d'engagement** et taux de complétion
- **Export des données** (CSV/Excel)

## 🏗️ Architecture Technique

### Frontend
- **React 18** + TypeScript
- **Tailwind CSS** pour le styling
- **Framer Motion** pour les animations
- **Vite** pour le build et le développement

### Backend
- **Django 5.0** + Python 3.11+
- **Django REST Framework** pour l'API
- **PostgreSQL** comme base de données principale
- **Redis** pour le cache et les sessions
- **GraphQL** avec Graphene-Django

### Infrastructure
- **CDN** pour les assets et vidéos
- **Stockage S3/R2** pour les fichiers
- **Elasticsearch** pour la recherche
- **Monitoring** avec Sentry et Prometheus

## 🚀 Installation & Configuration

### Prérequis
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- FFmpeg (pour le traitement vidéo)

### 1. Cloner le projet
```bash
git clone https://github.com/votre-username/kakatar-academy.git
cd kakatar-academy
```

### 2. Configuration Backend
```bash
# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Installer les dépendances
cd backend
pip install -r requirements.txt

# Créer le fichier .env
cp .env.example .env
# Éditer .env avec vos configurations

# Migrations et superuser
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

# Démarrer le serveur
python manage.py runserver
```

### 3. Configuration Frontend
```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

### 4. Configuration Base de Données
```sql
-- Créer la base de données
CREATE DATABASE kakatar_academy;
CREATE USER kakatar_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE kakatar_academy TO kakatar_user;
```

## 🔧 Configuration des Variables d'Environnement

Créez un fichier `.env` dans le dossier `backend/` :

```env
# Django
DEBUG=True
SECRET_KEY=votre-secret-key-ici
ALLOWED_HOSTS=localhost,127.0.0.1

# Base de données
DB_NAME=kakatar_academy
DB_USER=kakatar_user
DB_PASSWORD=votre_mot_de_passe
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://127.0.0.1:6379/1

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=votre-email@gmail.com
EMAIL_HOST_PASSWORD=votre-app-password

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle
STRIPE_SECRET_KEY=sk_test_votre_cle
STRIPE_WEBHOOK_SECRET=whsec_votre_webhook

# OpenAI
OPENAI_API_KEY=votre_cle_openai

# AWS S3 (optionnel)
USE_S3=False
AWS_ACCESS_KEY_ID=votre_cle_aws
AWS_SECRET_ACCESS_KEY=votre_secret_aws
AWS_STORAGE_BUCKET_NAME=votre_bucket
```

## 📱 Structure de l'Application

```
kakataracademy/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── services/       # Services API
│   │   └── utils/          # Utilitaires
│   └── public/             # Assets statiques
├── backend/                 # Application Django
│   ├── kakatar_academy/    # Configuration principale
│   ├── users/              # Gestion des utilisateurs
│   ├── courses/            # Gestion des cours
│   ├── payments/           # Système de paiement
│   ├── sessions_live/      # Sessions en direct
│   ├── marketplace/        # Marketplace
│   ├── analytics/          # Analytics et reporting
│   └── ai_services/        # Services IA
└── docs/                   # Documentation
```

## 🧪 Tests

### Backend
```bash
cd backend
python manage.py test
```

### Frontend
```bash
npm run test
npm run test:coverage
```

## 🚀 Déploiement

### Production
```bash
# Backend
cd backend
python manage.py collectstatic
python manage.py migrate
gunicorn kakatar_academy.wsgi:application

# Frontend
npm run build
# Servir les fichiers build avec nginx
```

### Docker (optionnel)
```bash
docker-compose up -d
```

## 📚 API Documentation

L'API est documentée avec GraphQL et REST :

- **GraphQL** : `/graphql/`
- **REST API** : `/api/v1/`
- **Admin Django** : `/admin/`

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

- **Documentation** : [docs.kakataracademy.com](https://docs.kakataracademy.com)
- **Issues** : [GitHub Issues](https://github.com/votre-username/kakatar-academy/issues)
- **Email** : support@kakataracademy.com

## 🗺️ Roadmap

### Phase 1 (MVP) - ✅ Complété
- [x] Authentification et gestion des utilisateurs
- [x] Création et gestion des cours
- [x] Système de paiement de base
- [x] Interface utilisateur moderne

### Phase 2 - 🚧 En cours
- [ ] Intégration des gateways de paiement
- [ ] Système de streaming vidéo
- [ ] Services IA de base
- [ ] Marketplace

### Phase 3 - 📋 Planifié
- [ ] Sessions en direct et collaboration
- [ ] Analytics avancés
- [ ] Applications mobiles
- [ ] Intégrations tierces

---

**Développé avec ❤️ par l'équipe Kakatar Academy** 