"""Badges et points d'expérience, calculés à partir de l'activité réelle de l'apprenant."""
from courses.models import Certificate, CourseReview, Enrollment, Lesson, QuizAttempt

# Points d'expérience par action
XP_LESSON = 10
XP_QUIZ_PASSED = 20
XP_CERTIFICATE = 100
XP_ASSIGNMENT_APPROVED = 50

# Paliers de niveau (XP cumulée nécessaire)
LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000]
LEVEL_NAMES = ['Curieux', 'Apprenti', 'Explorateur', 'Studieux', 'Passionné', 'Confirmé', 'Expert', 'Maître',
               'Virtuose', 'Légende']


def compute(user):
    from assignments.models import Submission
    from community.models import LessonComment
    from users.models import UserProfile

    profile, _ = UserProfile.objects.get_or_create(user=user)
    lessons_done = Lesson.objects.filter(completions__user=user).distinct().count()
    quizzes_passed = QuizAttempt.objects.filter(user=user, passed=True).values('lesson').distinct().count()
    perfect_quiz = QuizAttempt.objects.filter(user=user, score=100).exists()
    certificates = Certificate.objects.filter(enrollment__user=user).count()
    enrollments = Enrollment.objects.filter(user=user).exclude(status='CANCELLED').count()
    questions = LessonComment.objects.filter(user=user, parent__isnull=True, is_hidden=False).count()
    approved = Submission.objects.filter(user=user, status='APPROVED').count()
    reviews = CourseReview.objects.filter(user=user).count()
    streak = profile.longest_streak
    from analytics.models import ReviewCard
    mastered = ReviewCard.objects.filter(user=user, mastered=True).count()

    xp = (lessons_done * XP_LESSON + quizzes_passed * XP_QUIZ_PASSED + certificates * XP_CERTIFICATE
          + approved * XP_ASSIGNMENT_APPROVED)
    level = max(i for i, threshold in enumerate(LEVELS) if xp >= threshold)
    next_threshold = LEVELS[level + 1] if level + 1 < len(LEVELS) else None

    def badge(key, title, description, icon, value, goal):
        return {'key': key, 'title': title, 'description': description, 'icon': icon,
                'unlocked': value >= goal, 'progress': min(value, goal), 'goal': goal}

    badges = [
        badge('first_step', 'Premier pas', "S'inscrire à un premier cours", 'rocket', enrollments, 1),
        badge('first_lesson', 'C\'est parti !', 'Terminer une première leçon', 'play', lessons_done, 1),
        badge('ten_lessons', 'Régulier', 'Terminer 10 leçons', 'book', lessons_done, 10),
        badge('fifty_lessons', 'Marathonien', 'Terminer 50 leçons', 'medal', lessons_done, 50),
        badge('quiz_master', 'Sans faute', 'Obtenir 100 % à un quiz', 'target', int(perfect_quiz), 1),
        badge('streak_7', 'Une semaine d\'affilée', 'Apprendre 7 jours de suite', 'flame', streak, 7),
        badge('streak_30', 'Discipline de fer', 'Apprendre 30 jours de suite', 'flame', streak, 30),
        badge('curious', 'Curieux', 'Poser une question sous une leçon', 'message', questions, 1),
        badge('builder', 'Bâtisseur', 'Faire valider un devoir ou un projet', 'hammer', approved, 1),
        badge('graduate', 'Diplômé', 'Obtenir un premier certificat', 'award', certificates, 1),
        badge('collector', 'Collectionneur', 'Obtenir 3 certificats', 'trophy', certificates, 3),
        badge('critic', 'Avis éclairé', 'Laisser un avis sur un cours', 'star', reviews, 1),
        badge('memory', "Mémoire d'éléphant", 'Maîtriser 20 questions en révision', 'target', mastered, 20),
    ]
    return {
        'xp': xp,
        'level': level + 1,
        'level_name': LEVEL_NAMES[level],
        'level_floor': LEVELS[level],
        'next_level_xp': next_threshold,
        'badges': badges,
        'unlocked_count': sum(b['unlocked'] for b in badges),
    }
