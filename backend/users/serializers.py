from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, UserProfile, UserVerification

class UserProfileSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le profil utilisateur"""
    
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = [
            'skills', 'certifications', 'experience_years',
            'learning_goals', 'preferred_categories',
            'courses_completed', 'total_study_time',
            'current_streak', 'longest_streak',
            'followers_count', 'following_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_followers_count(self, obj):
        return obj.get_followers_count()
    
    def get_following_count(self, obj):
        return obj.get_following_count()

class UserSerializer(serializers.ModelSerializer):
    """Sérialiseur principal pour les utilisateurs"""
    
    profile = UserProfileSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'role', 'verification_status', 'bio', 'avatar', 'avatar_url',
            'phone_number', 'country', 'city', 'timezone',
            'company', 'website', 'linkedin', 'twitter',
            'total_courses_created', 'total_students', 'total_revenue',
            'rating_average', 'rating_count', 'is_verified',
            'two_factor_enabled', 'last_activity', 'date_joined',
            'profile', 'full_name'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'verification_status', 'total_courses_created',
            'total_students', 'total_revenue', 'rating_average',
            'rating_count', 'is_verified', 'last_activity', 'date_joined'
        ]
    
    def get_avatar_url(self, obj):
        return obj.get_avatar_url()
    
    def get_full_name(self, obj):
        return obj.get_full_name()

class UserCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création d'utilisateurs"""
    
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'last_name',
            'password', 'password_confirm', 'role', 'phone_number',
            'country', 'city'
        ]
    
    # Seuls ces rôles peuvent être choisis à l'inscription (jamais ADMIN/MODERATEUR)
    SELF_SERVICE_ROLES = (User.Role.ETUDIANT, User.Role.FORMATEUR)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    def validate_role(self, value):
        if value not in self.SELF_SERVICE_ROLES:
            raise serializers.ValidationError("Rôle non autorisé à l'inscription.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        if not validated_data.get('username'):
            validated_data['username'] = validated_data['email']
        # Le profil est créé par le signal post_save
        return User.objects.create_user(password=password, **validated_data)

class UserUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour des utilisateurs"""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'bio', 'avatar', 'cover_image',
            'phone_number', 'country', 'city', 'timezone',
            'company', 'website', 'linkedin', 'twitter',
            'language', 'email_notifications', 'push_notifications'
        ]

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour du profil"""
    
    class Meta:
        model = UserProfile
        fields = [
            'skills', 'certifications', 'experience_years',
            'learning_goals', 'preferred_categories'
        ]

class LoginSerializer(serializers.Serializer):
    """Sérialiseur pour la connexion"""
    
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(request=self.context.get('request'),
                              username=email.lower(), password=password)
            if not user:
                raise serializers.ValidationError(
                    'Impossible de se connecter avec les identifiants fournis.'
                )
            if not user.is_active:
                raise serializers.ValidationError(
                    'Ce compte a été désactivé.'
                )
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError(
                'Les champs email et password sont requis.'
            )

class PasswordChangeSerializer(serializers.Serializer):
    """Sérialiseur pour le changement de mot de passe"""
    
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("Les nouveaux mots de passe ne correspondent pas.")
        return attrs

class PasswordResetSerializer(serializers.Serializer):
    """Sérialiseur pour la réinitialisation de mot de passe"""
    
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    """Sérialiseur pour la confirmation de réinitialisation de mot de passe"""

    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs

class UserVerificationSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la vérification des comptes formateurs"""
    
    user = UserSerializer(read_only=True)
    verified_by = UserSerializer(read_only=True)
    
    class Meta:
        model = UserVerification
        fields = [
            'id', 'user', 'id_document', 'professional_cv', 'portfolio_url',
            'verification_notes', 'verified_by', 'verified_at', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'verified_by', 'verified_at', 'created_at', 'updated_at']

class UserVerificationCreateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création d'une demande de vérification"""
    
    class Meta:
        model = UserVerification
        fields = ['id_document', 'professional_cv', 'portfolio_url']

class UserVerificationUpdateSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la mise à jour du statut de vérification (admin)"""
    
    class Meta:
        model = UserVerification
        fields = ['status', 'verification_notes']

class FollowUserSerializer(serializers.Serializer):
    """Sérialiseur pour suivre/ne plus suivre un utilisateur"""
    
    user_id = serializers.UUIDField()

class UserStatsSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les statistiques utilisateur"""
    
    class Meta:
        model = User
        fields = [
            'total_courses_created', 'total_students', 'total_revenue',
            'rating_average', 'rating_count', 'courses_completed',
            'total_study_time', 'current_streak', 'longest_streak'
        ]

class UserSearchSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la recherche d'utilisateurs"""
    
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'avatar_url', 'role', 'bio',
            'company', 'country', 'city', 'rating_average',
            'total_courses_created', 'total_students'
        ]
    
    def get_full_name(self, obj):
        return obj.get_full_name()
    
    def get_avatar_url(self, obj):
        return obj.get_avatar_url() 