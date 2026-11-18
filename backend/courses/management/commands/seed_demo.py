from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from courses.models import Category, Course, Lesson, Module
from marketplace.models import Product
from payments.models import Coupon
from sessions_live.models import LiveSession
from users.models import User

CATEGORIES = [
    ('Développement Web', 'code', '#2563EB'),
    ('Data Science', 'bar-chart', '#7C3AED'),
    ('Design', 'palette', '#DB2777'),
    ('Marketing digital', 'megaphone', '#EA580C'),
    ('Entrepreneuriat', 'briefcase', '#059669'),
]

INSTRUCTORS = [
    ('jean@example.com', 'Jean', 'Martin', 'Expert en développement web, 12 ans d\'expérience.'),
    ('sarah@example.com', 'Sarah', 'Chen', 'Data scientist senior, passionnée de pédagogie.'),
    ('ahmed@example.com', 'Ahmed', 'Okafor', 'Designer UX/UI, ancien lead design en agence.'),
]

COURSES = [
    ('React & Next.js - Formation Complète', 0, 'Développement Web', 'INTERMEDIAIRE', 89000,
     'Maîtrisez React et Next.js de A à Z avec des projets pratiques et des techniques avancées.',
     'https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Data Science avec Python', 1, 'Data Science', 'AVANCE', 125000,
     'Analysez et visualisez vos données avec Python, Pandas, NumPy et Matplotlib.',
     'https://images.pexels.com/photos/590020/pexels-photo-590020.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Design UX/UI Moderne', 2, 'Design', 'DEBUTANT', 67000,
     'Créez des interfaces exceptionnelles avec Figma et les principes du design thinking.',
     'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('JavaScript ES6+ Avancé', 0, 'Développement Web', 'INTERMEDIAIRE', 75000,
     'Approfondissez JavaScript : fonctionnalités modernes, asynchrone et design patterns.',
     'https://images.pexels.com/photos/4164418/pexels-photo-4164418.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Initiation au HTML & CSS', 0, 'Développement Web', 'DEBUTANT', 0,
     'Le cours gratuit pour créer votre première page web, pas à pas.',
     'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800'),
    ('Lancer son activité en ligne', 2, 'Entrepreneuriat', 'DEBUTANT', 45000,
     'De l\'idée au premier client : méthode, outils et paiements mobiles.',
     'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800'),
]

LESSON_TEXT = (
    "Dans cette leçon, nous présentons les notions essentielles du module. Une bonne compréhension des "
    "composants permet de construire des applications maintenables. Les composants reçoivent des propriétés et "
    "gèrent leur propre état. La pratique régulière reste la meilleure façon de progresser durablement. "
    "Chaque exercice renforce la mémorisation des concepts vus en vidéo. Le projet final mobilise toutes les "
    "compétences acquises pendant le parcours."
)

SAMPLE_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'


class Command(BaseCommand):
    help = 'Crée des données de démonstration (comptes, cours, sessions, produits).'

    def add_arguments(self, parser):
        parser.add_argument('--password', default='password123', help='Mot de passe des comptes de démo')
        parser.add_argument('--force', action='store_true', help='Autoriser hors DEBUG')

    @transaction.atomic
    def handle(self, *args, **opts):
        if not settings.DEBUG and not opts['force']:
            raise CommandError('Refusé hors DEBUG (utilisez --force en connaissance de cause).')
        password = opts['password']

        def make_user(email, first, last, role, **extra):
            user, created = User.objects.get_or_create(email=email, defaults={
                'first_name': first, 'last_name': last, 'role': role, **extra})
            if created:
                user.set_password(password)
                user.save()
            return user

        admin = make_user('admin@kakatar.com', 'Admin', 'Kakatar', 'ADMIN', is_staff=True, is_superuser=True,
                          verification_status='VERIFIED', is_verified=True)
        student = make_user('marie@example.com', 'Marie', 'Dubois', 'ETUDIANT', country='Sénégal', city='Dakar')
        instructors = [make_user(email, first, last, 'FORMATEUR', bio=bio, verification_status='VERIFIED',
                                 is_verified=True, country='Sénégal')
                       for email, first, last, bio in INSTRUCTORS]

        categories = {}
        for i, (name, icon, color) in enumerate(CATEGORIES):
            categories[name], _ = Category.objects.get_or_create(name=name, defaults={
                'icon': icon, 'color': color, 'order': i})

        for title, inst_idx, cat, level, price, desc, thumb in COURSES:
            course, created = Course.objects.get_or_create(title=title, defaults={
                'description': desc, 'short_description': desc, 'category': categories[cat], 'level': level,
                'type': 'FREE' if price == 0 else 'PAID', 'price': price,
                'original_price': int(price * 1.3) if price else None, 'instructor': instructors[inst_idx],
                'thumbnail_url': thumb, 'status': 'PUBLISHED', 'is_featured': price > 80000,
                'objectives': ['Comprendre les fondamentaux', 'Réaliser un projet complet', 'Gagner en autonomie'],
                'requirements': ['Un ordinateur et une connexion internet'],
                'tags': [cat.lower(), level.lower()],
            })
            if not created:
                continue
            for m in range(1, 4):
                module = Module.objects.create(course=course, title=f'Module {m} : '
                                               + ['Introduction', 'Mise en pratique', 'Projet final'][m - 1],
                                               is_free=(m == 1))
                Lesson.objects.create(module=module, title=f'Leçon {m}.1 — Vidéo', type='VIDEO',
                                      video_url=SAMPLE_VIDEO, video_duration=600 + m * 60, content=LESSON_TEXT,
                                      is_free=(m == 1))
                Lesson.objects.create(module=module, title=f'Leçon {m}.2 — Lecture', type='TEXT',
                                      content=f'<h2>Points clés</h2><p>{LESSON_TEXT}</p>', estimated_duration=15)
                Lesson.objects.create(module=module, title=f'Leçon {m}.3 — Quiz', type='QUIZ', estimated_duration=5,
                                      content=LESSON_TEXT, quiz=[
                                          {'question': 'Quelle est la meilleure façon de progresser ?',
                                           'options': ['Regarder sans pratiquer', 'La pratique régulière',
                                                       'Tout apprendre en une fois'], 'answer': 1,
                                           'explanation': 'La pratique régulière ancre les acquis.'},
                                          {'question': 'Que reçoivent les composants ?',
                                           'options': ['Des propriétés', 'Des emails', 'Rien'], 'answer': 0,
                                           'explanation': 'Les composants reçoivent des propriétés.'},
                                      ])
            course.update_stats()

        now = timezone.now()
        sessions = [
            ('Workshop React Avancé', 0, 'PRESENTIAL', 'Dakar, Sénégal - Centre de formation Kakatar', 25000, 7, 180),
            ('Introduction à la Data Science', 1, 'ONLINE', '', 20000, 10, 240),
            ('Atelier Design Thinking', 2, 'HYBRID', 'Abidjan, Côte d\'Ivoire - Plateau', 15000, 14, 120),
            ('Questions / réponses : se lancer en freelance', 0, 'ONLINE', '', 0, 3, 60),
        ]
        for title, inst_idx, s_type, location, price, days, duration in sessions:
            LiveSession.objects.get_or_create(title=title, defaults={
                'description': f'{title} : une session interactive avec exercices pratiques et questions/réponses.',
                'instructor': instructors[inst_idx], 'type': s_type, 'location': location, 'price': price,
                'start_at': (now + timedelta(days=days)).replace(hour=14, minute=0, second=0, microsecond=0),
                'duration': duration, 'capacity': 30, 'category': list(categories.values())[inst_idx]})

        products = [
            ('Template de portfolio React', 0, 'TEMPLATE', 15000),
            ('Notebook d\'analyse de données', 1, 'SOURCE_CODE', 10000),
            ('Guide du design system (e-book)', 2, 'EBOOK', 0),
            ('Coaching carrière tech — 1 h', 0, 'COACHING', 30000),
        ]
        for title, inst_idx, p_type, price in products:
            Product.objects.get_or_create(title=title, defaults={
                'seller': instructors[inst_idx], 'type': p_type, 'price': price,
                'description': f'{title} — prêt à l\'emploi, mis à jour régulièrement.',
                'preview_url': COURSES[inst_idx][6]})

        Coupon.objects.get_or_create(code='BIENVENUE20', defaults={
            'description': '20 % sur votre premier cours', 'discount_type': 'PERCENTAGE', 'discount_value': 20,
            'valid_from': now - timedelta(days=1), 'valid_until': now + timedelta(days=365), 'per_user_limit': 1})

        self.stdout.write(self.style.SUCCESS(
            f'Données de démo prêtes. Comptes (mot de passe « {password} ») : '
            f'{admin.email}, {student.email}, ' + ', '.join(i.email for i in instructors)))
