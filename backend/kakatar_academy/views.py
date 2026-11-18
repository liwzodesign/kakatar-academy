from django.db import connection
from django.http import JsonResponse


def health(request):
    """Healthcheck utilisé par Docker / Nginx / la supervision."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_ok = True
    except Exception:  # pragma: no cover - dépend de l'infra
        db_ok = False
    status = 200 if db_ok else 503
    return JsonResponse({'status': 'ok' if db_ok else 'degraded', 'database': db_ok}, status=status)


def handler404(request, exception=None):
    return JsonResponse({'error': 'Ressource introuvable'}, status=404)


def handler500(request):
    return JsonResponse({'error': 'Erreur interne du serveur'}, status=500)
