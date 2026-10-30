"""Crée la structure des formations Kakatar Academy.

    python manage.py seed_kakatar_courses --instructor ndiogou@exemple.com
    python manage.py seed_kakatar_courses --instructor ... --publish

Les cours sont créés en BROUILLON par défaut : le contenu des leçons est à
compléter depuis l'admin (/admin/) avant publication. La commande est
idempotente : relancée, elle n'écrase pas le contenu déjà saisi.
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from courses.models import Category, Course, Lesson, Module
from users.models import User

CATEGORIES = [
    ('Design graphique', 'design-graphique', '#E85D04'),
    ('Développement web', 'developpement-web', '#2563EB'),
    ('Informatique de base', 'informatique-de-base', '#059669'),
]

# (titre, slug, catégorie, niveau, prix XOF, sous-titre, modules[(titre, [leçons])])
COURSES = [
    (
        'Infographie : les fondamentaux du design graphique', 'infographie-fondamentaux',
        'design-graphique', 'DEBUTANT', 25000,
        'Composer des visuels professionnels : couleur, typographie, mise en page et outils.',
        [
            ('Bases du design graphique', ['Le rôle du graphiste', 'Les principes de composition',
                                          'Formats, résolution et modes colorimétriques']),
            ('Couleur et typographie', ['Théorie des couleurs', 'Choisir et associer des polices',
                                        'Hiérarchie visuelle']),
            ('Outils de création', ['Prise en main de Photoshop', 'Prise en main d\'Illustrator',
                                    'Alternatives gratuites : Photopea, Inkscape, Canva']),
            ('Identité visuelle', ['Créer un logo', 'Construire une charte graphique',
                                   'Déclinaisons : carte de visite, en-tête, réseaux sociaux']),
            ('Supports print et digital', ['Préparer un fichier pour l\'impression', 'Flyers et affiches',
                                           'Visuels pour les réseaux sociaux']),
            ('Projet final', ['Brief client', 'Réalisation du projet', 'Présentation et portfolio']),
        ],
    ),
    (
        'Développement web : HTML, CSS et PHP', 'html-css-php',
        'developpement-web', 'DEBUTANT', 35000,
        'Créer et mettre en ligne un site web dynamique, de la première page au formulaire connecté.',
        [
            ('HTML', ['Structure d\'une page web', 'Textes, liens et images', 'Listes et tableaux',
                      'Formulaires', 'HTML sémantique et accessibilité']),
            ('CSS', ['Sélecteurs et propriétés', 'Le modèle de boîte', 'Flexbox', 'Grid',
                     'Responsive design et media queries']),
            ('PHP', ['Installer un environnement local', 'Variables, conditions et boucles',
                     'Fonctions et tableaux', 'Traiter un formulaire', 'Sessions et sécurité de base']),
            ('Base de données', ['Introduction à MySQL', 'PHP et PDO', 'Construire un CRUD']),
            ('Projet final', ['Cahier des charges du site', 'Réalisation', 'Mise en ligne']),
        ],
    ),
    (
        'Initiation à l\'informatique', 'initiation-informatique',
        'informatique-de-base', 'DEBUTANT', 0,
        'Six modules pour devenir à l\'aise avec l\'ordinateur, les fichiers, Internet et la bureautique.',
        [
            ('Découvrir l\'ordinateur', ['Matériel et logiciel', 'Allumer, utiliser la souris et le clavier']),
            ('Système d\'exploitation et fichiers', ['Le bureau et les fenêtres', 'Dossiers et fichiers',
                                                    'Clé USB et stockage']),
            ('Traitement de texte', ['Saisir et mettre en forme un texte', 'Créer un CV simple']),
            ('Tableur', ['Cellules, lignes et colonnes', 'Formules de base']),
            ('Internet et email', ['Naviguer et rechercher efficacement', 'Créer et utiliser une adresse email']),
            ('Sécurité numérique', ['Mots de passe et arnaques en ligne', 'Protéger ses données']),
        ],
    ),
]

PLACEHOLDER = "Contenu à rédiger. Ajoutez le texte de la leçon ou l'URL de la vidéo depuis l'admin."


class Command(BaseCommand):
    help = 'Crée les formations Kakatar Academy (infographie, HTML/CSS/PHP, initiation informatique).'

    def add_arguments(self, parser):
        parser.add_argument('--instructor', required=True, help="Email du formateur (compte existant)")
        parser.add_argument('--publish', action='store_true', help='Publier les cours et leçons')

    def handle(self, *args, instructor, publish, **options):
        user = User.objects.filter(email__iexact=instructor).first()
        if not user:
            raise CommandError(f"Aucun compte avec l'email {instructor}. Créez-le d'abord (createsuperuser).")

        cats = {}
        for order, (name, slug, color) in enumerate(CATEGORIES):
            cats[slug], _ = Category.objects.get_or_create(
                slug=slug, defaults={'name': name, 'color': color, 'order': order})

        lesson_status = Lesson.Status.PUBLISHED if publish else Lesson.Status.DRAFT
        for title, slug, cat, level, price, subtitle, modules in COURSES:
            course, created = Course.objects.get_or_create(slug=slug, defaults={
                'title': title, 'subtitle': subtitle, 'short_description': subtitle,
                'description': subtitle, 'category': cats[cat], 'level': level,
                'type': Course.Type.FREE if price == 0 else Course.Type.PAID,
                'price': price, 'currency': 'XOF', 'instructor': user,
            })
            for m_order, (m_title, lessons) in enumerate(modules, start=1):
                module, _ = Module.objects.get_or_create(
                    course=course, order=m_order, defaults={'title': m_title})
                for l_order, l_title in enumerate(lessons, start=1):
                    lesson, l_created = Lesson.objects.get_or_create(
                        module=module, order=l_order, defaults={
                            'title': l_title, 'type': Lesson.Type.TEXT, 'content': PLACEHOLDER,
                            'estimated_duration': 20, 'status': lesson_status,
                            # première leçon du cours en aperçu gratuit
                            'is_free': m_order == 1 and l_order == 1,
                        })
                    if publish and lesson.status != Lesson.Status.PUBLISHED:
                        lesson.status = Lesson.Status.PUBLISHED
                        lesson.save(update_fields=['status'])
            if publish and course.status != Course.Status.PUBLISHED:
                course.status = Course.Status.PUBLISHED
                course.published_at = course.published_at or timezone.now()
                course.save(update_fields=['status', 'published_at'])
            course.update_stats()
            self.stdout.write(self.style.SUCCESS(
                f"{'Créé' if created else 'Déjà présent'} : {course.title} "
                f"({course.modules.count()} modules, statut {course.get_status_display()})"))
