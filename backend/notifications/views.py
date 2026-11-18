from rest_framework import generics, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'kind', 'title', 'message', 'link', 'is_read', 'created_at']


class NotificationListView(generics.ListAPIView):
    """Notifications de l'utilisateur (?unread=true pour les non lues)."""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get('unread') == 'true':
            qs = qs.filter(is_read=False)
        return qs


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def unread_count(request):
    return Response({'unread': Notification.objects.filter(user=request.user, is_read=False).count()})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_read(request):
    """Corps : {"ids": [...]} pour certaines notifications, ou {} pour tout marquer comme lu."""
    qs = Notification.objects.filter(user=request.user, is_read=False)
    ids = request.data.get('ids')
    if ids:
        qs = qs.filter(id__in=ids)
    return Response({'updated': qs.update(is_read=True)})
