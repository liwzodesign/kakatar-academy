"""
Services IA. Utilise l'API OpenAI si OPENAI_API_KEY est défini, sinon des heuristiques
locales (aucune dépendance lourde) pour que chaque fonctionnalité reste utilisable.
"""
import json
import logging
import random
import re
from collections import Counter

from django.conf import settings
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

STOPWORDS = set("""
a à au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur lui ma mais me même mes
moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre
vous c d j l n s t y été être avoir est sont plus comme si tout tous toute toutes the of and to in is it for on
that this with are be as an or by from at your you can will
""".split())

BLOCKLIST = {'arnaque', 'escroquerie', 'connard', 'salope', 'pute', 'merde', 'enculé', 'nique', 'fdp', 'scam',
             'fuck', 'shit', 'bitch', 'idiot', 'imbécile', 'abruti'}


def llm_available():
    return bool(settings.OPENAI_API_KEY)


def _chat(system, user, json_mode=False, max_tokens=800):
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30)
    kwargs = {'response_format': {'type': 'json_object'}} if json_mode else {}
    resp = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        temperature=0.4, max_tokens=max_tokens, **kwargs,
    )
    return resp.choices[0].message.content or ''


def _clean(text):
    return re.sub(r'\s+', ' ', strip_tags(text or '')).strip()


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', _clean(text)) if len(s.split()) >= 6]


def _keywords(text, n=10):
    words = [w.lower() for w in re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{3,}", text)]
    return [w for w, _ in Counter(w for w in words if w not in STOPWORDS).most_common(n)]


# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
def summarize(text, max_sentences=4):
    text = _clean(text)
    if not text:
        return ''
    if llm_available():
        try:
            return _chat('Tu es un assistant pédagogique. Résume le contenu de cours fourni en français, '
                         'en 3 à 5 phrases claires, puis liste 3 points clés précédés de « - ».',
                         text[:12000], max_tokens=400).strip()
        except Exception:
            logger.exception('Résumé OpenAI impossible, repli heuristique')
    # Résumé extractif : phrases contenant le plus de mots-clés
    sentences = _sentences(text)
    if len(sentences) <= max_sentences:
        return ' '.join(sentences) or text[:500]
    keywords = set(_keywords(text, 15))
    scored = sorted(enumerate(sentences),
                    key=lambda p: -sum(1 for w in re.findall(r'\w+', p[1].lower()) if w in keywords))
    chosen = sorted(scored[:max_sentences])
    return ' '.join(s for _, s in chosen)


# ---------------------------------------------------------------------------
# Génération de quiz
# ---------------------------------------------------------------------------
def generate_quiz(text, num_questions=5):
    """Renvoie [{question, options[4], answer, explanation}]."""
    text = _clean(text)
    num_questions = max(1, min(num_questions, 15))
    if not text:
        return []
    if llm_available():
        try:
            raw = _chat(
                'Tu crées des QCM pédagogiques en français. Réponds uniquement en JSON : '
                '{"questions": [{"question": str, "options": [4 str], "answer": index 0-3, "explanation": str}]}.',
                f'Crée {num_questions} questions à partir de ce contenu :\n\n{text[:12000]}',
                json_mode=True, max_tokens=1500)
            questions = json.loads(raw).get('questions', [])
            valid = [q for q in questions if isinstance(q.get('options'), list) and len(q['options']) >= 2
                     and isinstance(q.get('answer'), int) and 0 <= q['answer'] < len(q['options'])]
            if valid:
                return valid[:num_questions]
        except Exception:
            logger.exception('Quiz OpenAI impossible, repli heuristique')
    return _cloze_quiz(text, num_questions)


def _cloze_quiz(text, num_questions):
    """Questions « texte à trous » : un mot-clé est masqué, les distracteurs sont d'autres mots-clés."""
    keywords = _keywords(text, 30)
    if len(keywords) < 4:
        return []
    rng = random.Random(len(text))
    questions = []
    for sentence in _sentences(text):
        target = next((k for k in keywords if re.search(rf'\b{re.escape(k)}\b', sentence, re.I)), None)
        if not target:
            continue
        blank = re.sub(rf'\b{re.escape(target)}\b', '_____', sentence, count=1, flags=re.I)
        distractors = rng.sample([k for k in keywords if k != target], 3)
        options = distractors + [target]
        rng.shuffle(options)
        questions.append({
            'question': f'Complétez : « {blank} »',
            'options': options,
            'answer': options.index(target),
            'explanation': f'La phrase exacte du cours est : « {sentence} »',
        })
        if len(questions) >= num_questions:
            break
    return questions


# ---------------------------------------------------------------------------
# Tuteur IA
# ---------------------------------------------------------------------------
def tutor_answer(question, context_text, course_title=''):
    context_text = _clean(context_text)
    if llm_available():
        try:
            return _chat(
                "Tu es le tuteur de la plateforme Kakatar Academy. Réponds en français, de façon pédagogique et "
                "concise, en t'appuyant d'abord sur le contenu de la leçon fourni. Si la question sort du cadre, "
                "dis-le poliment.",
                f'Cours : {course_title}\n\nContenu de la leçon :\n{context_text[:10000]}\n\nQuestion : {question}',
                max_tokens=600).strip()
        except Exception:
            logger.exception('Tuteur OpenAI indisponible, repli heuristique')
    # Repli : passages de la leçon les plus proches de la question
    q_words = set(_keywords(question, 10))
    sentences = _sentences(context_text)
    ranked = sorted(sentences, key=lambda s: -len(q_words & set(re.findall(r'\w+', s.lower()))))
    best = [s for s in ranked[:3] if q_words & set(re.findall(r'\w+', s.lower()))]
    if not best:
        return ("Je n'ai pas trouvé la réponse dans cette leçon. Essayez de reformuler votre question ou "
                "posez-la à votre formateur dans les avis du cours.")
    return 'Voici les passages de la leçon qui répondent à votre question :\n\n' + '\n'.join(f'• {s}' for s in best)


# ---------------------------------------------------------------------------
# Modération
# ---------------------------------------------------------------------------
def moderate_text(text):
    """Renvoie {'flagged': bool, 'categories': [...]}."""
    text = text or ''
    if llm_available():
        try:
            from openai import OpenAI
            result = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=15).moderations.create(
                model='omni-moderation-latest', input=text[:5000]).results[0]
            categories = [k for k, v in result.categories.model_dump().items() if v]
            return {'flagged': bool(result.flagged), 'categories': categories}
        except Exception:
            logger.exception('Modération OpenAI indisponible, repli heuristique')
    words = set(re.findall(r"[\wÀ-ÿ']+", text.lower()))
    hits = sorted(words & BLOCKLIST)
    has_contact_spam = bool(re.search(r'(https?://|www\.|wa\.me|\+?\d[\d\s]{8,})', text))
    categories = (['insultes'] if hits else []) + (['spam'] if has_contact_spam else [])
    return {'flagged': bool(categories), 'categories': categories}


# ---------------------------------------------------------------------------
# Recommandations de cours
# ---------------------------------------------------------------------------
def recommend_courses(user, limit=8):
    """
    Score = affinité de catégorie (cours suivis, préférences) + affinité de niveau
            + popularité + note. Exclut les cours déjà suivis.
    """
    from courses.models import Course, Enrollment

    enrolled = Enrollment.objects.filter(user=user).select_related('course')
    enrolled_ids = {e.course_id for e in enrolled}
    cat_weights = Counter(e.course.category_id for e in enrolled)
    level_weights = Counter(e.course.level for e in enrolled)
    profile = getattr(user, 'profile', None)
    preferred = set(map(str, (profile.preferred_categories if profile else []) or []))

    candidates = Course.objects.filter(status='PUBLISHED').exclude(id__in=enrolled_ids).exclude(instructor=user) \
        .select_related('category', 'instructor')[:300]
    max_students = max([c.students_count for c in candidates] + [1])

    def score(course):
        s = 3.0 * cat_weights.get(course.category_id, 0)
        if str(course.category_id) in preferred or course.category.slug in preferred:
            s += 4
        s += 1.5 * level_weights.get(course.level, 0)
        s += 2.0 * (course.students_count / max_students)
        s += float(course.rating_average) * 0.6
        return s

    return sorted(candidates, key=score, reverse=True)[:limit]
