# Kakatar Academy

Plateforme de formation en ligne de Kakatar Graphic : catalogue, paiement Wave / Orange Money,
lecteur de leçons avec progression, et certificat PDF vérifiable.

## Ce qui fonctionne (MVP)

| Domaine | Détail |
|---|---|
| Comptes | Inscription, connexion JWT (rafraîchissement auto), mot de passe oublié par email |
| Catalogue | Recherche, filtres par catégorie, fiche formation avec programme |
| Accès | Contenu des leçons payantes masqué côté serveur ; leçon d'aperçu gratuite |
| Paiement | **Wave Checkout** et **PayDunya** (Orange Money, Free Money, carte), codes promo, commission formateur 15 % |
| Apprentissage | Lecteur (texte, vidéo YouTube/Vimeo/MP4), « marquer comme terminée », progression |
| Certificat | PDF généré à 100 %, code unique + page publique de vérification `/certificats/<code>` |
| Formateur | Liste de ses cours + statistiques (inscrits, complétion, ventes) ; contenu édité dans l'admin Django |

Prévu en V2 : sessions en présentiel, marketplace, recommandations IA, éditeur de cours dans le front,
double authentification.

## Démarrer en local

**Backend** (SQLite par défaut, aucun service externe requis)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "DEBUG=True" > .env
python manage.py migrate
python manage.py createsuperuser            # email + mot de passe
python manage.py seed_kakatar_courses --instructor VOTRE@EMAIL --publish
python manage.py runserver                  # http://localhost:8000  (admin : /admin/)
```

**Frontend**

```bash
npm install
npm run dev                                 # http://localhost:5173
```

**Tests**

```bash
cd backend && DEBUG=True python manage.py test   # 16 tests : accès, paiements, certificats, auth
npm run build                                    # typecheck + build
```

## Paiements

Le serveur ne fait jamais confiance au navigateur ni au contenu brut d'un webhook :
l'état d'un paiement est toujours **relu auprès de Wave / PayDunya** (montant compris) avant d'ouvrir l'accès.
La finalisation est idempotente (page de retour + webhook peuvent arriver tous les deux).

| Passerelle | À configurer dans `.env` | Webhook à déclarer chez la passerelle |
|---|---|---|
| Wave | `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` | `https://<domaine>/api/v1/payments/webhooks/wave/` |
| PayDunya | `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYDUNYA_MODE` | envoyé automatiquement (`callback_url`) |

Un moyen de paiement sans clés est simplement masqué sur le site.
Tester d'abord PayDunya en `PAYDUNYA_MODE=test`, et Wave avec un petit montant réel.

## Mise en ligne (Docker)

```bash
cp .env.example .env      # remplir SECRET_KEY, DB_PASSWORD, domaines, clés de paiement
docker compose up -d --build
docker compose exec backend python manage.py seed_kakatar_courses --instructor VOTRE@EMAIL
```

Trois conteneurs : PostgreSQL, Django (Gunicorn), Nginx (sert le React et relaie `/api` et `/admin`).
Prévoir le HTTPS devant (Caddy, Traefik ou Cloudflare) : Wave exige des URLs de retour en HTTPS.

## Ajouter le contenu des cours

`seed_kakatar_courses` crée les 3 formations (Infographie, HTML/CSS/PHP, Initiation à l'informatique)
avec modules et leçons. Le texte des leçons est un **emplacement à remplir** :
admin Django → Modules → ouvrir un module → éditer chaque leçon (texte, URL vidéo, statut « Publiée »).
Sans `--publish`, cours et leçons restent en brouillon, invisibles du public.

## Structure

```
backend/
  users/      comptes, JWT, réinitialisation du mot de passe
  courses/    cours, modules, leçons, inscriptions, progression, certificats (certificates.py)
  payments/   gateways.py (Wave, PayDunya), services.py (checkout, finalisation), webhooks
src/
  lib/api.ts  client API + JWT
  pages/      Catalog, CourseDetail, Learn, PaymentReturn, MyLearning, Teach, Auth, VerifyCertificate
```
