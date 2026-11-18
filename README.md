# 🎓 Kakatar Academy

Plateforme d'apprentissage en ligne : cours vidéo, quiz et certificats, sessions en direct (en ligne et en présentiel), marketplace de ressources, paiements mobiles (Wave, Orange Money via PayDunya) et par carte (Stripe), tuteur IA.

- **Backend** : Django 5.2 + Django REST Framework, JWT, Celery, PostgreSQL (obligatoire, dev compris), Redis
- **Frontend** : React 18 + TypeScript + Vite + Tailwind
- **Infra** : Docker Compose (Nginx, Gunicorn, Celery worker/beat), Prometheus/Grafana en option

---

## Démarrage rapide (développement)

Prérequis : Python 3.11+, Node.js 18+, **PostgreSQL 14+** (la seule base prise en charge).

1. Créer un utilisateur et une base PostgreSQL :

   ```sql
   CREATE ROLE kakatar LOGIN PASSWORD 'un-mot-de-passe' CREATEDB;  -- CREATEDB : bases de test
   CREATE DATABASE kakatar_academy OWNER kakatar;
   ```

2. Créer `backend/.env` :

   ```
   DEBUG=True
   DATABASE_URL=postgres://kakatar:un-mot-de-passe@localhost:5432/kakatar_academy
   ```

3. Lancer :

   ```bash
   ./start.sh dev
   ```

Le script crée `backend/.venv`, installe les dépendances, applique les migrations, charge des **données de démo** puis lance :

| Service | URL |
|---|---|
| Application | http://localhost:5173 |
| API | http://localhost:5173/api/v1/ (proxy Vite → Django :8000) |
| Admin Django | http://localhost:8000/admin/ |
| GraphQL (lecture) | http://localhost:8000/graphql/ |

Comptes de démo (mot de passe `password123`) : `marie@example.com` (étudiante), `jean@example.com` (formateur), `admin@kakatar.com` (admin). Code promo de démo : `BIENVENUE20`.

En développement, sans configuration :
- les **emails** s'affichent dans la console du backend ;
- les **paiements** sont **simulés** (page « Paiement de démonstration ») tant qu'aucune clé de passerelle n'est fournie ;
- les **tâches Celery** s'exécutent immédiatement (pas besoin de Redis) ;
- l'**IA** utilise des heuristiques locales (pas besoin de clé OpenAI).

### Manuellement

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # Linux/macOS : source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # facultatif
python manage.py runserver

# Frontend (autre terminal, à la racine)
npm install
npm run dev
```

## Tests

```bash
./start.sh test              # tout : pytest + tsc + eslint + build
cd backend && python -m pytest   # backend seul (≈ 10 s)
```

Les tests couvrent les parcours critiques : inscription/connexion/2FA/réinitialisation, verrouillage du contenu payant, achat avec coupon, idempotence des paiements, webhooks signés, remboursements, abonnements, sessions (capacité, paiement, rappels), marketplace (téléchargement sécurisé, livraison), tableaux de bord, exports CSV, IA locale. La CI GitHub Actions (`.github/workflows/ci.yml`) les exécute sur PostgreSQL.

## Production (Docker)

```bash
cp .env.example .env     # renseigner SECRET_KEY, POSTGRES_PASSWORD, domaine, SMTP, clés de paiement
docker compose up -d --build
docker compose --profile monitoring up -d    # Prometheus (127.0.0.1:9090), Grafana (127.0.0.1:3001), Flower (127.0.0.1:5555)
```

Services : `postgres`, `redis`, `backend` (Gunicorn, migrations au démarrage), `celery`, `celery-beat`, `nginx` (sert le build React et proxifie `/api`, `/admin`, `/graphql`, `/media`). Seul le port 80 est publié.

À faire avant la mise en ligne :
1. **HTTPS** : terminer TLS devant Nginx (Cloudflare, certbot…), puis `SECURE_SSL_REDIRECT=True`.
2. **Webhooks** à déclarer chez chaque passerelle (URL dans `.env.example`).
3. `PAYMENTS_ALLOW_SANDBOX=False` (valeur par défaut hors DEBUG).
4. Stockage des médias : disque (volume Docker) ou S3/Cloudflare R2 (`USE_S3=True`, URLs signées).
5. Sauvegardes PostgreSQL et du volume `media_volume`.

## Architecture backend

| App | Rôle | Préfixe API |
|---|---|---|
| `users` | Comptes (email), rôles, JWT + liste noire, 2FA TOTP, réinitialisation de mot de passe, vérification des formateurs, abonnements entre utilisateurs, administration des comptes | `/api/v1/auth/` |
| `courses` | Catégories, cours, modules, leçons (vidéo HLS, texte, quiz), inscriptions, progression, avis (modérés), favoris, certificats vérifiables | `/api/v1/courses/` |
| `payments` | Checkout Stripe / PayDunya / Wave (+ sandbox), webhooks, coupons, abonnements, commissions formateurs, remboursements, versements | `/api/v1/payments/` |
| `sessions_live` | Sessions en ligne (salle Jitsi auto) / présentiel, réservations gratuites ou payantes, rappels email, présence | `/api/v1/sessions/` |
| `marketplace` | Ressources numériques (téléchargement protégé) et prestations (livraison) | `/api/v1/marketplace/` |
| `analytics` | Tableaux de bord étudiant / formateur / admin, exports CSV, KPI quotidiens | `/api/v1/analytics/` |
| `ai_services` | Recommandations, génération de quiz, résumés, tuteur IA, modération (OpenAI si clé, sinon local) | `/api/v1/ai/` |
| `notifications` | Notifications in-app (cloche) : paiements, inscriptions, certificats, sessions, commandes, avis, questions | `/api/v1/notifications/` |
| `community` | Questions/réponses sous chaque leçon (inscrits + formateur), « résolu », j'aime, modération, boîte formateur, annonces du formateur à la classe | `/api/v1/community/` |
| `assignments` | Devoirs et projets : rendu (texte, lien, fichier privé), correction notée, reprise ou validation (valide la leçon) | `/api/v1/assignments/` |
| `paths` | Parcours : plusieurs cours vendus ensemble à prix réduit, progression globale, revenus répartis au prorata | `/api/v1/paths/` |
| `cohorts` | Promotions : groupe à dates fixes, places limitées, sessions live réservées aux membres (inscription automatique) | `/api/v1/cohorts/` |

Points clés :
- **Paiements** : aucune donnée bancaire ne transite par le serveur (pages hébergées des passerelles). La validation (`payments/services.py::fulfill_payment`) est idempotente : webhook et retour utilisateur peuvent arriver dans n'importe quel ordre.
- **Contenu protégé** : le contenu et les vidéos des leçons payantes ne sont renvoyés qu'aux inscrits ; les justificatifs formateurs et fichiers marketplace ne sont accessibles que via l'API (Nginx bloque leur URL directe).
- **Vidéo** : un fichier téléversé est transcodé en HLS 360p/720p par Celery + ffmpeg (inclus dans l'image Docker) ; sinon lecture MP4/YouTube/Vimeo.
- **Tâches planifiées** (Celery beat) : expiration des abonnements et paiements abandonnés, rappels de sessions (24 h / 1 h), rappels d'objectif quotidien (à l'heure choisie par l'étudiant), instantané quotidien des KPI.
- **Vidéos des leçons** : servies par des liens signés valables 6 h, l'accès étant revérifié à chaque requête (Nginx `X-Accel-Redirect` en production).
- **Hors connexion** : l'étudiant peut enregistrer une leçon (texte + vidéo MP4) sur son appareil (`src/lib/offline.ts`, Cache Storage) et la revoir sans réseau depuis « Téléchargements ».
- **Révisions intelligentes** (`analytics/learning.py`) : chaque question de quiz ratée devient une carte de révision (5 boîtes de Leitner : 1, 3, 7, 16, 35 jours) ; page « Révisions ».
- **Écouter la leçon** : lecture à voix haute par la synthèse vocale de l'appareil (aucune donnée consommée, fonctionne hors connexion).
- **Ligue de la semaine** (classement par minutes, prénom + initiale seulement, désactivable) et **profil public** facultatif `/u/<adresse>` (certificats vérifiables, badges, compétences ; jamais l'email).
- **Économie de données** (`src/lib/dataSaver.ts`) : vidéo chargée à la demande, en plus basse qualité HLS ; activée automatiquement en 2G/3G ou si le téléphone le demande.

## Application installable (PWA)

Le site s'installe sur l'écran d'accueil (Android, iOS, ordinateur) : `public/manifest.webmanifest`, icônes dans `public/icons/`, service worker `public/sw.js` (actif en production uniquement). Le service worker met en cache l'application et ses fichiers statiques, **jamais** les réponses de l'API ni les médias privés. Hors connexion, l'application s'ouvre et affiche un message clair.

## Architecture frontend

- `src/lib/api.ts` : client HTTP (JWT, rafraîchissement automatique, erreurs lisibles, téléchargements)
- `src/lib/router.ts` : routage par URL (pages publiques : accueil, catalogue, cours, sessions, marketplace, vérification de certificat)
- `src/lib/mappers.ts` : conversion des réponses API vers les types de `src/types`
- `src/components/` : `Course`, `Path`, `Cohort`, `Session`, `Marketplace`, `Payment`, `Dashboard`, `Instructor`, `Admin`, `Account`, `UI`

## Variables d'environnement

Toutes documentées dans [`.env.example`](.env.example). En local, placer le fichier dans `backend/.env` ; avec Docker, à la racine.

## Limites connues / pistes

- Pas d'application mobile native (le site est responsive).
- Recherche via la base de données (suffisant jusqu'à plusieurs milliers de cours ; Elasticsearch/Meilisearch possible ensuite).
- Les versements aux formateurs sont marqués « versés » manuellement après virement (pas de payout automatique).
- Le schéma GraphQL est en lecture seule (catalogue) ; l'API REST reste la référence.
