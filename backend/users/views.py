import pyotp
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import filters, generics, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from notifications.services import notify

from .emails import send_templated_email
from .models import UserProfile, UserVerification
from .permissions import IsAdminUser, IsFormateurUser
from .serializers import (
    FollowUserSerializer, LoginSerializer, PasswordChangeSerializer,
    PasswordResetConfirmSerializer, PasswordResetSerializer, UserCreateSerializer,
    UserProfileUpdateSerializer, UserSearchSerializer, UserSerializer, UserStatsSerializer,
    UserUpdateSerializer, UserVerificationCreateSerializer, UserVerificationSerializer,
    UserVerificationUpdateSerializer,
)

User = get_user_model()


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class UserRegistrationView(AuthThrottleMixin, generics.CreateAPIView):
    """Inscription d'un étudiant ou d'un formateur."""
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_templated_email('Bienvenue sur Kakatar Academy ! 🎓', 'emails/welcome.html',
                             {'user': user}, [user.email])
        return Response({
            'message': 'Compte créé avec succès',
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': _tokens_for(user),
        }, status=status.HTTP_201_CREATED)


class UserLoginView(AuthThrottleMixin, APIView):
    """Connexion par email + mot de passe (+ code TOTP si la 2FA est activée)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.last_activity = timezone.now()
        user.last_login = timezone.now()
        user.last_login_ip = _client_ip(request)
        user.save(update_fields=['last_activity', 'last_login', 'last_login_ip'])
        return Response({
            'message': 'Connexion réussie',
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': _tokens_for(user),
        })


class UserLogoutView(APIView):
    """Déconnexion : le refresh token est mis en liste noire."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh') or request.data.get('refresh_token')
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass
        return Response({'message': 'Déconnexion réussie'})


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Profil de l'utilisateur connecté (GET / PUT / PATCH)."""
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        super().update(request, *args, **kwargs)
        return Response(UserSerializer(self.get_object(), context={'request': request}).data)


class UserProfileUpdateView(generics.UpdateAPIView):
    """Mise à jour du profil étendu (compétences, objectifs…)."""
    serializer_class = UserProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Ancien mot de passe incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Mot de passe modifié avec succès'})


class PasswordResetView(AuthThrottleMixin, APIView):
    """Envoie un lien de réinitialisation (uid + token signé, valable PASSWORD_RESET_TIMEOUT)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data['email'], is_active=True).first()
        if user:
            from django.conf import settings
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_templated_email('Réinitialisation de votre mot de passe', 'emails/password_reset.html',
                                 {'user': user, 'reset_url': reset_url}, [user.email])
        # Réponse identique que l'email existe ou non (pas d'énumération de comptes)
        return Response({'message': 'Si un compte existe, un email de réinitialisation a été envoyé.'})


class PasswordResetConfirmView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(serializer.validated_data['uid'])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError, Exception):
            user = None
        if user is None or not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response({'error': 'Lien invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Mot de passe réinitialisé avec succès'})


class UserVerificationCreateView(generics.CreateAPIView):
    """Un formateur dépose ses justificatifs (pièce d'identité, CV)."""
    serializer_class = UserVerificationCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]

    def perform_create(self, serializer):
        existing = UserVerification.objects.filter(user=self.request.user).first()
        if existing and existing.status not in ('REJECTED', 'NEEDS_MORE_INFO'):
            raise serializers.ValidationError("Une demande de vérification est déjà en cours.")
        if existing:
            existing.delete()
        serializer.save(user=self.request.user)
        self.request.user.verification_status = User.VerificationStatus.PENDING
        self.request.user.save(update_fields=['verification_status'])


class UserVerificationDetailView(generics.RetrieveAPIView):
    serializer_class = UserVerificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        verification = UserVerification.objects.filter(user=self.request.user).first()
        if not verification:
            from django.http import Http404
            raise Http404('Aucune demande de vérification')
        return verification


class UserVerificationListView(generics.ListAPIView):
    """Liste des demandes de vérification (admin)."""
    serializer_class = UserVerificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = UserVerification.objects.select_related('user', 'verified_by')
        status_filter = self.request.query_params.get('status')
        return qs.filter(status=status_filter) if status_filter else qs


class UserVerificationUpdateView(generics.UpdateAPIView):
    """Validation / rejet d'une demande (admin)."""
    queryset = UserVerification.objects.all()
    serializer_class = UserVerificationUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def perform_update(self, serializer):
        verification = serializer.save(verified_by=self.request.user, verified_at=timezone.now())
        user = verification.user
        if verification.status == 'APPROVED':
            user.verification_status = User.VerificationStatus.VERIFIED
            user.is_verified = True
            user.save(update_fields=['verification_status', 'is_verified'])
            notify(user, 'ACCOUNT', 'Compte formateur vérifié ✅', 'Vous pouvez publier vos cours.', '/create-course')
            send_templated_email('Votre compte formateur a été vérifié ! ✅', 'emails/verification_approved.html',
                                 {'user': user}, [user.email])
        elif verification.status == 'REJECTED':
            user.verification_status = User.VerificationStatus.REJECTED
            user.is_verified = False
            user.save(update_fields=['verification_status', 'is_verified'])
            notify(user, 'ACCOUNT', 'Demande de vérification refusée', verification.verification_notes[:200],
                   '/settings?tab=verification')
            send_templated_email('Mise à jour sur votre demande de vérification',
                                 'emails/verification_rejected.html',
                                 {'user': user, 'notes': verification.verification_notes}, [user.email])


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def verification_document(request, pk, field):
    """Téléchargement d'un justificatif (admin uniquement ; /media/verification est bloqué par Nginx)."""
    import mimetypes
    import os
    from django.http import FileResponse, Http404

    if field not in ('id_document', 'professional_cv'):
        raise Http404
    verification = generics.get_object_or_404(UserVerification, pk=pk)
    file_field = getattr(verification, field)
    if not file_field:
        raise Http404
    name = os.path.basename(file_field.name)
    return FileResponse(file_field.open('rb'), filename=name,
                        content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')


class UserSearchView(generics.ListAPIView):
    serializer_class = UserSearchSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'username', 'bio', 'company']
    ordering_fields = ['rating_average', 'total_courses_created', 'date_joined']
    ordering = ['-rating_average']

    def get_queryset(self):
        queryset = User.objects.filter(is_active=True, is_banned=False)
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)
        return queryset


class AdminUserListView(generics.ListAPIView):
    """Gestion des utilisateurs (admin) : liste complète, filtrable."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['-date_joined']

    def get_queryset(self):
        qs = User.objects.select_related('profile')
        role = self.request.query_params.get('role')
        return qs.filter(role=role) if role else qs


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_set_user_status(request, pk):
    """Bannir / réactiver un utilisateur, ou changer son rôle (admin)."""
    user = generics.get_object_or_404(User, pk=pk)
    if user == request.user:
        return Response({'error': 'Action impossible sur votre propre compte'}, status=status.HTTP_400_BAD_REQUEST)
    fields = []
    if 'is_banned' in request.data:
        user.is_banned = bool(request.data['is_banned'])
        fields.append('is_banned')
    if 'role' in request.data:
        if request.data['role'] not in User.Role.values:
            return Response({'error': 'Rôle invalide'}, status=status.HTTP_400_BAD_REQUEST)
        user.role = request.data['role']
        fields.append('role')
    if fields:
        user.save(update_fields=fields)
    return Response(UserSerializer(user, context={'request': request}).data)


class FollowUserView(APIView):
    """Suivre / ne plus suivre un utilisateur (bascule)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = User.objects.filter(id=serializer.validated_data['user_id']).first()
        if not target:
            return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)
        if target == request.user:
            return Response({'error': 'Vous ne pouvez pas vous suivre vous-même'},
                            status=status.HTTP_400_BAD_REQUEST)
        # Les abonnés de « target » sont stockés sur son profil
        target_profile, _ = UserProfile.objects.get_or_create(user=target)
        if target_profile.followers.filter(id=request.user.id).exists():
            target_profile.followers.remove(request.user)
            action = 'unfollowed'
        else:
            target_profile.followers.add(request.user)
            action = 'followed'
        return Response({
            'message': 'Abonnement mis à jour',
            'action': action,
            'followers_count': target_profile.get_followers_count(),
        })


class UserStatsView(generics.RetrieveAPIView):
    serializer_class = UserStatsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        UserProfile.objects.get_or_create(user=self.request.user)
        return self.request.user


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_recommendations(request):
    """Recommandations d'utilisateurs : formateurs pour les étudiants, pairs sinon."""
    user = request.user
    following_ids = user.following.values_list('user_id', flat=True)
    if user.role == User.Role.ETUDIANT:
        qs = User.objects.filter(role=User.Role.FORMATEUR, is_verified=True, is_active=True)
    else:
        qs = User.objects.filter(role=User.Role.FORMATEUR, is_active=True)
    qs = qs.exclude(id=user.id).exclude(id__in=following_ids).order_by('-rating_average', '-total_students')[:10]
    return Response(UserSearchSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def two_factor_setup(request):
    """Étape 1 : génère un secret TOTP et l'URI à scanner (Google Authenticator, Authy…)."""
    user = request.user
    if user.two_factor_enabled:
        return Response({'error': 'La 2FA est déjà activée'}, status=status.HTTP_400_BAD_REQUEST)
    user.totp_secret = pyotp.random_base32()
    user.save(update_fields=['totp_secret'])
    uri = pyotp.TOTP(user.totp_secret).provisioning_uri(name=user.email, issuer_name='Kakatar Academy')
    return Response({'secret': user.totp_secret, 'otpauth_uri': uri})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_two_factor(request):
    """
    Étape 2 : active la 2FA en confirmant un code, ou la désactive (code requis aussi).
    Corps : {"code": "123456"}
    """
    user = request.user
    code = str(request.data.get('code', ''))
    if not user.totp_secret or not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        return Response({'error': 'Code invalide'}, status=status.HTTP_400_BAD_REQUEST)
    user.two_factor_enabled = not user.two_factor_enabled
    if not user.two_factor_enabled:
        user.totp_secret = ''
    user.save(update_fields=['two_factor_enabled', 'totp_secret'])
    return Response({
        'message': '2FA activée' if user.two_factor_enabled else '2FA désactivée',
        'two_factor_enabled': user.two_factor_enabled,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def referral_overview(request):
    """Mon code de parrainage, mon lien, mes filleuls et mes récompenses."""
    from django.conf import settings
    from django.utils import timezone as tz
    from payments.models import Coupon

    user = request.user
    code = user.ensure_referral_code()
    referrals = user.referrals.all()
    rewards = Coupon.objects.filter(reserved_for=user, code__startswith='PARRAIN-').order_by('-created_at')
    return Response({
        'code': code,
        'link': f"{settings.FRONTEND_URL.rstrip('/')}/?ref={code}",
        'reward_percent': settings.REFERRAL_REWARD_PERCENT,
        'referred_count': referrals.count(),
        'converted_count': referrals.filter(referral_rewarded=True).count(),
        'rewards': [{
            'code': c.code, 'discount': c.get_discount_display(), 'valid_until': c.valid_until,
            'used': c.usage_count >= (c.usage_limit or 1), 'expired': c.valid_until < tz.now(),
        } for c in rewards],
    })
