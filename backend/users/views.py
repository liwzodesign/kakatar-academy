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
import uuid

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
        try:
            subject = 'Bienvenue sur Kakatar Academy ! 🎓'
            message = render_to_string('emails/welcome.html', {
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
            print(f"Erreur envoi email: {e}")

class UserLoginView(APIView):
    """Vue pour la connexion des utilisateurs"""
    permission_classes = [permissions.AllowAny]
    
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
        if self.request.method == 'PUT':
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
    """Vue pour demander la réinitialisation du mot de passe"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email)
            
            # Générer un token unique
            token = str(uuid.uuid4())
            
            # Stocker le token dans le cache (en production, utiliser Redis)
            # cache.set(f"password_reset_{token}", user.id, timeout=3600)
            
            # Envoyer l'email de réinitialisation
            self.send_reset_email(user, token)
            
            return Response({'message': 'Email de réinitialisation envoyé'})
            
        except User.DoesNotExist:
            # Ne pas révéler si l'email existe ou non
            return Response({'message': 'Email de réinitialisation envoyé'})
    
    def send_reset_email(self, user, token):
        """Envoie l'email de réinitialisation"""
        try:
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            
            subject = 'Réinitialisation de votre mot de passe'
            message = render_to_string('emails/password_reset.html', {
                'user': user,
                'reset_url': reset_url,
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
            print(f"Erreur envoi email reset: {e}")

class PasswordResetConfirmView(APIView):
    """Vue pour confirmer la réinitialisation du mot de passe"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        # Récupérer l'utilisateur depuis le cache
        # user_id = cache.get(f"password_reset_{token}")
        
        # Pour l'instant, simulation
        user_id = None
        
        if not user_id:
            return Response({'error': 'Token invalide ou expiré'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(id=user_id)
            user.set_password(new_password)
            user.save()
            
            # Supprimer le token du cache
            # cache.delete(f"password_reset_{token}")
            
            return Response({'message': 'Mot de passe réinitialisé avec succès'})
            
        except User.DoesNotExist:
            return Response({'error': 'Utilisateur non trouvé'}, 
                          status=status.HTTP_404_NOT_FOUND)

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