from rest_framework import status, generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.throttling import ScopedRateThrottle

from .models import User, UserProfile, UserVerification
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    UserProfileUpdateSerializer, LoginSerializer, PasswordChangeSerializer,
    PasswordResetSerializer, PasswordResetConfirmSerializer,
    UserVerificationSerializer, UserVerificationCreateSerializer,
    UserVerificationUpdateSerializer, FollowUserSerializer,
    UserStatsSerializer, UserSearchSerializer
)
from .permissions import IsOwnerOrReadOnly, IsAdminUser, IsFormateurUser

User = get_user_model()

class UserRegistrationView(generics.CreateAPIView):
    """Vue pour l'inscription des utilisateurs"""
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        
        # Envoyer l'email de bienvenue
        self.send_welcome_email(user)
        
        return Response({
            'message': 'Compte créé avec succès',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=status.HTTP_201_CREATED)
    
    def send_welcome_email(self, user):
        """Envoie l'email de bienvenue"""
        send_mail(
            subject='Bienvenue sur Kakatar Academy !',
            message=(f"Bonjour {user.get_short_name()},\n\n"
                     "Votre compte Kakatar Academy est prêt. Bonne formation !\n\n"
                     f"{settings.FRONTEND_URL}"),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

class UserLoginView(APIView):
    """Vue pour la connexion des utilisateurs"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        
        # Mettre à jour la dernière activité
        user.last_activity = timezone.now()
        user.save(update_fields=['last_activity'])
        
        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'message': 'Connexion réussie',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })

class UserLogoutView(APIView):
    """Vue pour la déconnexion des utilisateurs"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            return Response({'message': 'Déconnexion réussie'})
        except Exception as e:
            return Response({'error': 'Erreur lors de la déconnexion'}, 
                          status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(generics.RetrieveUpdateAPIView):
    """Vue pour afficher et modifier le profil utilisateur"""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_object(self):
        return self.request.user
    
    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

class UserProfileUpdateView(generics.UpdateAPIView):
    """Vue pour mettre à jour le profil étendu"""
    serializer_class = UserProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_object(self):
        return self.request.user.profile

class PasswordChangeView(APIView):
    """Vue pour changer le mot de passe"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        
        # Vérifier l'ancien mot de passe
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Ancien mot de passe incorrect'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Changer le mot de passe
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({'message': 'Mot de passe modifié avec succès'})

class PasswordResetView(APIView):
    """Demande de réinitialisation : envoie un lien uid + token signé (valable PASSWORD_RESET_TIMEOUT)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reinitialiser-mot-de-passe?uid={uid}&token={token}"
            send_mail(
                subject='Réinitialisation de votre mot de passe - Kakatar Academy',
                message=(
                    f"Bonjour {user.get_short_name()},\n\n"
                    f"Pour choisir un nouveau mot de passe, ouvrez ce lien :\n{reset_url}\n\n"
                    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        # Même réponse que l'email existe ou non
        return Response({'message': 'Si un compte existe, un email de réinitialisation a été envoyé.'})


class PasswordResetConfirmView(APIView):
    """Confirme la réinitialisation avec uid + token."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user_id = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError, ValidationError):
            user = None
        if user is None or not default_token_generator.check_token(user, data['token']):
            return Response({'error': 'Lien invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data['new_password'])
        user.save(update_fields=['password'])
        return Response({'message': 'Mot de passe réinitialisé avec succès'})


class UserVerificationCreateView(generics.CreateAPIView):
    """Vue pour créer une demande de vérification"""
    serializer_class = UserVerificationCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsFormateurUser]
    
    def perform_create(self, serializer):
        # Vérifier qu'il n'y a pas déjà une demande en cours
        if hasattr(self.request.user, 'verification'):
            raise serializers.ValidationError("Une demande de vérification est déjà en cours")
        
        serializer.save(user=self.request.user)

class UserVerificationDetailView(generics.RetrieveAPIView):
    """Vue pour afficher les détails de la vérification"""
    serializer_class = UserVerificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.verification

class UserVerificationUpdateView(generics.UpdateAPIView):
    """Vue pour mettre à jour le statut de vérification (admin)"""
    queryset = UserVerification.objects.all()
    serializer_class = UserVerificationUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    
    def perform_update(self, serializer):
        verification = serializer.save(verified_by=self.request.user)
        
        if verification.status == 'APPROVED':
            # Mettre à jour le statut de l'utilisateur
            user = verification.user
            user.verification_status = 'VERIFIED'
            user.is_verified = True
            user.save(update_fields=['verification_status', 'is_verified'])
            
            # Envoyer un email de confirmation
            self.send_verification_email(user, True)
        elif verification.status == 'REJECTED':
            # Envoyer un email de rejet
            self.send_verification_email(user, False)
    
    def send_verification_email(self, user, approved):
        """Envoie l'email de confirmation/rejet de vérification"""
        try:
            if approved:
                subject = 'Votre compte formateur a été vérifié ! ✅'
                template = 'emails/verification_approved.html'
            else:
                subject = 'Mise à jour sur votre demande de vérification'
                template = 'emails/verification_rejected.html'
            
            message = render_to_string(template, {
                'user': user,
                'site_name': 'Kakatar Academy'
            })
            
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=message,
                fail_silently=True
            )
        except Exception as e:
            print(f"Erreur envoi email vérification: {e}")

class UserSearchView(generics.ListAPIView):
    """Vue pour rechercher des utilisateurs"""
    serializer_class = UserSearchSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'username', 'bio', 'company']
    ordering_fields = ['rating_average', 'total_courses_created', 'date_joined']
    ordering = ['-rating_average']
    
    def get_queryset(self):
        queryset = User.objects.filter(is_active=True)
        
        # Filtrer par rôle si spécifié
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        # Filtrer par pays si spécifié
        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        return queryset

class FollowUserView(APIView):
    """Vue pour suivre/ne plus suivre un utilisateur"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = FollowUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_to_follow_id = serializer.validated_data['user_id']
        
        try:
            user_to_follow = User.objects.get(id=user_to_follow_id)
            
            if user_to_follow == request.user:
                return Response({'error': 'Vous ne pouvez pas vous suivre vous-même'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            profile = request.user.profile
            
            if profile.followers.filter(id=user_to_follow_id).exists():
                # Ne plus suivre
                profile.followers.remove(user_to_follow)
                action = 'unfollowed'
            else:
                # Suivre
                profile.followers.add(user_to_follow)
                action = 'followed'
            
            return Response({
                'message': f'Utilisateur {action} avec succès',
                'action': action,
                'followers_count': profile.get_followers_count()
            })
            
        except User.DoesNotExist:
            return Response({'error': 'Utilisateur non trouvé'}, 
                          status=status.HTTP_404_NOT_FOUND)

class UserStatsView(generics.RetrieveAPIView):
    """Vue pour afficher les statistiques utilisateur"""
    serializer_class = UserStatsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_recommendations(request):
    """Vue pour obtenir des recommandations d'utilisateurs"""
    user = request.user
    
    # Logique de recommandation basique
    # En production, utiliser des algorithmes IA plus sophistiqués
    
    # Recommandations basées sur le rôle
    if user.role == User.Role.ETUDIANT:
        # Recommander des formateurs
        recommendations = User.objects.filter(
            role=User.Role.FORMATEUR,
            is_verified=True,
            is_active=True
        ).exclude(id=user.id)[:10]
    else:
        # Recommander des étudiants
        recommendations = User.objects.filter(
            role=User.Role.ETUDIANT,
            is_active=True
        ).exclude(id=user.id)[:10]
    
    serializer = UserSearchSerializer(recommendations, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_two_factor(request):
    """Vue pour activer/désactiver l'authentification à deux facteurs"""
    user = request.user
    
    if user.two_factor_enabled:
        user.two_factor_enabled = False
        message = 'Authentification à deux facteurs désactivée'
    else:
        user.two_factor_enabled = True
        message = 'Authentification à deux facteurs activée'
    
    user.save(update_fields=['two_factor_enabled'])
    
    return Response({
        'message': message,
        'two_factor_enabled': user.two_factor_enabled
    }) 