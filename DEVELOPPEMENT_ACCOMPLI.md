# État du développement — Kakatar Academy

_Mis à jour le 18 novembre 2026._

## Ce qui a été corrigé par rapport à la version initiale

La version précédente de ce document annonçait un projet « prêt », mais le backend ne démarrait pas :
- 4 apps déclarées (`sessions_live`, `marketplace`, `analytics`, `ai_services`) n'existaient pas ;
- `courses` et `payments` n'étaient pas des apps Django (pas de `__init__.py`/`apps.py`), `payments` n'avait ni vues ni routes ;
- aucune migration, fichiers référencés absents (`signals.py`, `celery.py`, templates, handlers d'erreurs) ;
- connexion par email impossible (`USERNAME_FIELD` absent), réinitialisation de mot de passe et 2FA simulées ;
- le frontend fonctionnait entièrement sur des données fictives ;
- `docker-compose.yml` pointait vers des fichiers inexistants.

## Ce qui est en place

| Domaine | État |
|---|---|
| Authentification (JWT, rôles, 2FA TOTP, mot de passe oublié, vérification formateurs) | ✅ testé |
| Cours (création/édition, modules, leçons, quiz, progression, certificats, avis modérés, favoris) | ✅ testé |
| Vidéo (upload, transcodage HLS ffmpeg via Celery, lecteur HLS) | ✅ (transcodage non testé sans ffmpeg local) |
| Paiements (Stripe Checkout, PayDunya, Wave, sandbox, webhooks signés, coupons, abonnements, commissions, remboursements, versements) | ✅ testé en sandbox — **à valider avec de vraies clés de test de chaque passerelle** |
| Sessions en direct (Jitsi, présentiel, réservation payante, rappels) | ✅ testé |
| Marketplace (ressources, prestations, téléchargement protégé) | ✅ testé |
| Analytics (3 tableaux de bord, exports CSV, KPI quotidiens) | ✅ testé |
| IA (recommandations, quiz, résumés, tuteur, modération) | ✅ testé en mode local — mode OpenAI à valider avec une clé |
| Base de données : PostgreSQL uniquement (dev, tests, Docker) — SQLite retiré | ✅ testé sur PostgreSQL 18 (local) et 16 (Docker) |
| Notifications in-app (cloche, compteur, liens directs) | ✅ testé |
| Questions/réponses par leçon + boîte « questions en attente » du formateur | ✅ testé |
| Identité visuelle (logo officiel, palette, typographie Plus Jakarta Sans) et nouvelle page d'accueil | ✅ vérifié par captures d'écran (ordinateur + mobile, sans débordement, sans erreur console) |
| Refonte complète de l'interface : lecteur de cours plein écran, éditeur de cours avec aperçu, pages admin, paramètres, sessions, composants partagés (`src/components/UI/kit.tsx`) | ✅ 25 pages vérifiées par captures (ordinateur + mobile 390 px) : aucun débordement, aucune erreur console |
| Devoirs et projets corrigés (rendu, note, reprise, validation automatique de la leçon) | ✅ testé |
| Annonces du formateur (notification + email en tâche de fond) et préférences d'email | ✅ testé |
| Gestion des codes promo dans l'interface admin | ✅ vérifié à l'écran |
| Application installable (PWA) et mode hors connexion | ✅ vérifié (service worker actif, page ouverte sans réseau) |
| Demandes de versement des formateurs (Wave, Orange Money, Free Money, virement) et traitement admin | ✅ testé |
| Parrainage (lien personnel, récompense au premier achat du filleul, code réservé au parrain) | ✅ testé |
| Badges et points d'expérience (12 badges, 10 niveaux) | ✅ testé |
| Ajout des sessions à l'agenda (Google Agenda, fichier .ics) | ✅ testé |
| Réponse publique du formateur aux avis | ✅ testé |
| Codes promo créés par les formateurs (limités à leurs propres cours, 90 % max.) | ✅ testé + vérifié à l'écran |
| Objectif quotidien (5 à 60 min), série, 7 derniers jours, rappel email à l'heure choisie | ✅ testé + vérifié à l'écran |
| Leçons hors connexion (page « Téléchargements ») et mode économie de données | ✅ vérifié à l'écran — enregistrement d'une vraie vidéo à tester sur téléphone |
| Parcours (catalogue public, fiche, achat groupé, gestion formateur) | ✅ testé + vérifié à l'écran |
| Révisions intelligentes (répétition espacée des questions ratées) | ✅ testé + session vérifiée dans le navigateur |
| Écouter la leçon (synthèse vocale, vitesse réglable, hors connexion) | ✅ vérifié à l'écran |
| Ligue de la semaine et profil public / portfolio (activable dans Paramètres) | ✅ testé + vérifié (ordinateur et mobile) |
| Promotions / cohortes (inscription, places, sessions live réservées) | ✅ testé + parcours « rejoindre » vérifié dans le navigateur |
| Frontend relié à l'API (toutes les pages) | ✅ build + typage OK, parcours achat vérifié par HTTP |
| Docker / Nginx / Celery / PostgreSQL 16 | ✅ images construites, pile démarrée, parcours d'achat complet vérifié via Nginx sur PostgreSQL (monitoring non lancé) |
| CI GitHub Actions | ✅ écrite, à déclencher au premier push |

Tests backend : 71 tests pytest, tous verts (sur PostgreSQL).

## Reste à faire avant la production

1. Créer les comptes marchands (Stripe, PayDunya, Wave), tester chaque passerelle en mode test, déclarer les webhooks.
2. Mettre en place HTTPS et le domaine ; configurer le SMTP.
3. Décider des politiques commerciales (remboursement, taux de commission, prix des abonnements, montant minimum de versement, récompense de parrainage) — valeurs par défaut dans `.env.example` / `settings.py`.
4. Relire les textes de la FAQ (`src/components/Account/Support.tsx`) et l'adresse de support.
5. Tests en navigateur (parcours étudiant, formateur, admin) sur mobile et ordinateur.
