import csv
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from courses.models import Certificate, Course, Enrollment
from courses.serializers import CourseListSerializer, EnrollmentSerializer
from marketplace.models import Order
from payments.models import Commission, Payment
from sessions_live.models import LiveSession, SessionRegistration
from users.permissions import IsAdminUser, IsFormateurUser

from .models import DailySnapshot

User = get_user_model()


def _days_series(qs, date_field, days=30, value=None):
    """Série journalière complète (jours sans données = 0) sur `days` jours."""
    since = timezone.now() - timedelta(days=days - 1)
    agg = value if value is not None else Count('pk')
    rows = qs.filter(**{f'{date_field}__gte': since}).annotate(day=TruncDate(date_field)) \
        .values('day').annotate(v=agg).order_by('day')
    by_day = {r['day']: r['v'] for r in rows}
    start = timezone.localdate() - timedelta(days=days - 1)
    return [{'date': str(start + timedelta(days=i)), 'value': float(by_day.get(start + timedelta(days=i)) or 0)}
            for i in range(days)]


# ---------------------------------------------------------------------------
# Étudiant
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_dashboard(request):
    user = request.user
    from users.models import UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=user)
    enrollments = Enrollment.objects.filter(user=user).exclude(status='CANCELLED') \
        .select_related('course__instructor', 'course__category', 'certificate')
    in_progress = enrollments.filter(status='ACTIVE').order_by('-last_accessed')
    upcoming = SessionRegistration.objects.filter(
        user=user, status='CONFIRMED', session__start_at__gte=timezone.now()
    ).select_related('session').order_by('session__start_at')[:5]

    enrolled_categories = enrollments.values_list('course__category_id', flat=True)
    recommended = Course.objects.filter(status='PUBLISHED', category_id__in=list(enrolled_categories)) \
        .exclude(enrollments__user=user).exclude(instructor=user).select_related('instructor', 'category') \
        .order_by('-rating_average')[:4]
    if not recommended:
        recommended = Course.objects.filter(status='PUBLISHED').exclude(enrollments__user=user) \
            .select_related('instructor', 'category').order_by('-students_count')[:4]

    return Response({
        'stats': {
            'enrolled_courses': enrollments.count(),
            'completed_courses': enrollments.filter(status='COMPLETED').count(),
            'certificates': Certificate.objects.filter(enrollment__user=user).count(),
            'study_time_minutes': profile.total_study_time,
            'current_streak': profile.current_streak,
            'longest_streak': profile.longest_streak,
            'average_progress': float(in_progress.aggregate(a=Avg('progress'))['a'] or 0),
        },
        'in_progress': EnrollmentSerializer(in_progress[:6], many=True, context={'request': request}).data,
        'upcoming_sessions': [{
            'id': str(r.session.id), 'title': r.session.title, 'start_at': r.session.start_at,
            'type': r.session.type, 'location': r.session.location,
        } for r in upcoming],
        'recommended': CourseListSerializer(recommended, many=True, context={'request': request}).data,
    })


# ---------------------------------------------------------------------------
# Formateur
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_dashboard(request):
    user = request.user
    courses = Course.objects.filter(instructor=user).exclude(status='ARCHIVED')
    enrollments = Enrollment.objects.filter(course__instructor=user).exclude(status='CANCELLED')
    commissions = Commission.objects.filter(instructor=user)
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    top_courses = courses.filter(status='PUBLISHED').order_by('-students_count')[:5]
    return Response({
        'stats': {
            'total_courses': courses.count(),
            'published_courses': courses.filter(status='PUBLISHED').count(),
            'draft_courses': courses.filter(status='DRAFT').count(),
            'total_students': enrollments.values('user').distinct().count(),
            'new_students_this_month': enrollments.filter(enrolled_at__gte=month_start).count(),
            'rating_average': float(user.rating_average),
            'rating_count': user.rating_count,
            'net_revenue': float(commissions.aggregate(s=Sum('instructor_amount'))['s'] or 0),
            'revenue_this_month': float(commissions.filter(created_at__gte=month_start)
                                        .aggregate(s=Sum('instructor_amount'))['s'] or 0),
            'pending_payout': float(commissions.filter(is_paid=False).aggregate(s=Sum('instructor_amount'))['s'] or 0),
            'completion_rate': float(courses.filter(status='PUBLISHED').aggregate(a=Avg('completion_rate'))['a'] or 0),
            'upcoming_sessions': LiveSession.objects.filter(instructor=user, start_at__gte=timezone.now())
            .exclude(status='CANCELLED').count(),
        },
        'revenue_30_days': _days_series(commissions, 'created_at', 30, Sum('instructor_amount')),
        'enrollments_30_days': _days_series(enrollments, 'enrolled_at', 30),
        'top_courses': CourseListSerializer(top_courses, many=True, context={'request': request}).data,
        'recent_enrollments': [{
            'student': e.user.get_full_name(), 'course': e.course.title, 'date': e.enrolled_at,
            'progress': float(e.progress),
        } for e in enrollments.select_related('user', 'course').order_by('-enrolled_at')[:8]],
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsFormateurUser])
def instructor_students(request):
    """Liste paginée des inscriptions aux cours du formateur (filtre ?course=<slug>, ?search=)."""
    from django.core.paginator import Paginator

    qs = Enrollment.objects.filter(course__instructor=request.user).exclude(status='CANCELLED') \
        .select_related('user', 'course').order_by('-enrolled_at')
    if request.query_params.get('course'):
        qs = qs.filter(course__slug=request.query_params['course'])
    search = request.query_params.get('search')
    if search:
        qs = qs.filter(Q(user__first_name__icontains=search) | Q(user__last_name__icontains=search)
                       | Q(user__email__icontains=search))
    page = Paginator(qs, 25).get_page(request.query_params.get('page', 1))
    return Response({
        'count': page.paginator.count,
        'num_pages': page.paginator.num_pages,
        'results': [{
            'id': str(e.id), 'student': e.user.get_full_name(), 'email': e.user.email,
            'course': e.course.title, 'course_slug': e.course.slug, 'status': e.status,
            'progress': float(e.progress), 'enrolled_at': e.enrolled_at, 'last_accessed': e.last_accessed,
        } for e in page.object_list],
    })


# ---------------------------------------------------------------------------
# Administration
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_dashboard(request):
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_payments = Payment.objects.filter(status='COMPLETED', is_sandbox=False)
    revenue_by_month = (completed_payments.filter(completed_at__gte=now - timedelta(days=365))
                        .annotate(month=TruncMonth('completed_at')).values('month')
                        .annotate(total=Sum('amount')).order_by('month'))
    users_by_role = dict(User.objects.values_list('role').annotate(c=Count('id')))
    top_courses = Course.objects.filter(status='PUBLISHED').select_related('instructor', 'category') \
        .order_by('-students_count')[:5]
    return Response({
        'stats': {
            'total_users': User.objects.count(),
            'new_users_this_month': User.objects.filter(date_joined__gte=month_start).count(),
            'active_users_7d': User.objects.filter(last_activity__gte=now - timedelta(days=7)).count(),
            'users_by_role': users_by_role,
            'total_courses': Course.objects.exclude(status='ARCHIVED').count(),
            'published_courses': Course.objects.filter(status='PUBLISHED').count(),
            'total_enrollments': Enrollment.objects.exclude(status='CANCELLED').count(),
            'completion_rate': float(Course.objects.filter(status='PUBLISHED')
                                     .aggregate(a=Avg('completion_rate'))['a'] or 0),
            'revenue_total': float(completed_payments.aggregate(s=Sum('amount'))['s'] or 0),
            'revenue_this_month': float(completed_payments.filter(completed_at__gte=month_start)
                                        .aggregate(s=Sum('amount'))['s'] or 0),
            'platform_commission': float(Commission.objects.filter(payment__is_sandbox=False)
                                         .aggregate(s=Sum('commission_amount'))['s'] or 0),
            'pending_verifications': User.objects.filter(role='FORMATEUR', verification_status='PENDING',
                                                         verification__status='PENDING').count(),
            'pending_payouts': float(Commission.objects.filter(is_paid=False)
                                     .aggregate(s=Sum('instructor_amount'))['s'] or 0),
            'marketplace_orders': Order.objects.exclude(status__in=['PENDING', 'CANCELLED']).count(),
            'upcoming_sessions': LiveSession.objects.filter(start_at__gte=now, status='SCHEDULED').count(),
            'failed_payments_7d': Payment.objects.filter(status='FAILED', created_at__gte=now - timedelta(days=7)).count(),
        },
        'signups_30_days': _days_series(User.objects.all(), 'date_joined', 30),
        'revenue_by_month': [{'month': r['month'].strftime('%Y-%m'), 'total': float(r['total'])}
                             for r in revenue_by_month],
        'top_courses': CourseListSerializer(top_courses, many=True, context={'request': request}).data,
        'snapshots': list(DailySnapshot.objects.values()[:30]),
    })


# ---------------------------------------------------------------------------
# Exports CSV
# ---------------------------------------------------------------------------
def _csv_response(filename, header, rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('﻿')  # BOM pour l'ouverture correcte dans Excel
    writer = csv.writer(response, delimiter=';')
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def export_csv(request, dataset):
    """
    Exports : admin → users | payments | enrollments ; formateur → students | sales.
    """
    user = request.user
    is_admin = user.role == 'ADMIN'
    is_instructor = user.role in ('FORMATEUR', 'ADMIN')
    date = timezone.localdate().isoformat()

    if dataset == 'users' and is_admin:
        qs = User.objects.all().order_by('date_joined')
        return _csv_response(f'utilisateurs-{date}.csv', ['Email', 'Prénom', 'Nom', 'Rôle', 'Pays', 'Vérifié',
                                                          'Inscription'],
                             ((u.email, u.first_name, u.last_name, u.role, u.country, u.is_verified,
                               u.date_joined.isoformat()) for u in qs.iterator()))
    if dataset == 'payments' and is_admin:
        qs = Payment.objects.select_related('user').order_by('created_at')
        return _csv_response(f'paiements-{date}.csv', ['Référence', 'Email', 'Montant', 'Devise', 'Type',
                                                       'Passerelle', 'Statut', 'Sandbox', 'Date'],
                             ((p.reference, p.user.email, p.amount, p.currency, p.type, p.gateway, p.status,
                               p.is_sandbox, p.created_at.isoformat()) for p in qs.iterator()))
    if dataset == 'enrollments' and is_admin:
        qs = Enrollment.objects.select_related('user', 'course').order_by('enrolled_at')
        return _csv_response(f'inscriptions-{date}.csv', ['Étudiant', 'Email', 'Cours', 'Statut', 'Progression',
                                                          'Date'],
                             ((e.user.get_full_name(), e.user.email, e.course.title, e.status, e.progress,
                               e.enrolled_at.isoformat()) for e in qs.iterator()))
    if dataset == 'students' and is_instructor:
        qs = Enrollment.objects.filter(course__instructor=user).select_related('user', 'course').order_by('enrolled_at')
        return _csv_response(f'mes-etudiants-{date}.csv', ['Étudiant', 'Email', 'Cours', 'Statut', 'Progression',
                                                           'Date'],
                             ((e.user.get_full_name(), e.user.email, e.course.title, e.status, e.progress,
                               e.enrolled_at.isoformat()) for e in qs.iterator()))
    if dataset == 'sales' and is_instructor:
        qs = Commission.objects.filter(instructor=user).select_related('payment__user').order_by('created_at')
        return _csv_response(f'mes-ventes-{date}.csv', ['Référence', 'Description', 'Acheteur', 'Montant',
                                                        'Commission', 'Net', 'Versé', 'Date'],
                             ((c.payment.reference, c.payment.description, c.payment.user.get_full_name(),
                               c.total_amount, c.commission_amount, c.instructor_amount, c.is_paid,
                               c.created_at.isoformat()) for c in qs.iterator()))
    return Response({'error': 'Export inconnu ou non autorisé'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def achievements(request):
    from .achievements import compute
    return Response(compute(request.user))


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def daily_goal(request):
    """Objectif quotidien : progression du jour, 7 derniers jours, réglages du rappel."""
    from users.models import UserProfile
    from .models import DailyActivity

    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if request.method == 'PATCH':
        try:
            goal = request.data.get('daily_goal_minutes')
            if goal is not None:
                if int(goal) not in (5, 10, 15, 30, 45, 60):
                    return Response({'error': 'Objectif invalide.'}, status=status.HTTP_400_BAD_REQUEST)
                profile.daily_goal_minutes = int(goal)
            if 'reminder_enabled' in request.data:
                profile.reminder_enabled = bool(request.data['reminder_enabled'])
            if 'reminder_hour' in request.data:
                hour = int(request.data['reminder_hour'])
                if not 6 <= hour <= 22:
                    return Response({'error': 'Heure entre 6 h et 22 h.'}, status=status.HTTP_400_BAD_REQUEST)
                profile.reminder_hour = hour
        except (TypeError, ValueError):
            return Response({'error': 'Valeur invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        profile.save(update_fields=['daily_goal_minutes', 'reminder_enabled', 'reminder_hour'])

    today = timezone.localdate()
    rows = {a.date: a for a in DailyActivity.objects.filter(user=request.user, date__gte=today - timedelta(days=6))}
    today_row = rows.get(today)
    minutes = today_row.minutes if today_row else 0
    return Response({
        'daily_goal_minutes': profile.daily_goal_minutes,
        'reminder_enabled': profile.reminder_enabled,
        'reminder_hour': profile.reminder_hour,
        'today_minutes': minutes,
        'today_lessons': today_row.lessons_completed if today_row else 0,
        'reached': minutes >= profile.daily_goal_minutes,
        'current_streak': profile.current_streak,
        'last_7_days': [{
            'date': str(today - timedelta(days=i)),
            'minutes': rows[today - timedelta(days=i)].minutes if (today - timedelta(days=i)) in rows else 0,
        } for i in range(6, -1, -1)],
    })
