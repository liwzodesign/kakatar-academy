from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission personnalisée pour permettre aux propriétaires de modifier leurs objets
    """
    
    def has_object_permission(self, request, view, obj):
        # Les permissions de lecture sont autorisées pour toute requête
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Les permissions d'écriture sont autorisées uniquement au propriétaire
        return obj == request.user

class IsAdminUser(permissions.BasePermission):
    """
    Permission pour les administrateurs uniquement
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'

class IsFormateurUser(permissions.BasePermission):
    """
    Permission pour les formateurs uniquement
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['FORMATEUR', 'ADMIN']
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated and request.user.role in ['FORMATEUR', 'ADMIN']

class IsModerateurUser(permissions.BasePermission):
    """
    Permission pour les modérateurs uniquement
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['MODERATEUR', 'ADMIN']
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated and request.user.role in ['MODERATEUR', 'ADMIN']

class IsVerifiedFormateur(permissions.BasePermission):
    """
    Permission pour les formateurs vérifiés uniquement
    """
    
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and 
                request.user.role in ['FORMATEUR', 'ADMIN'] and 
                request.user.verification_status == 'VERIFIED')
    
    def has_object_permission(self, request, view, obj):
        return (request.user and request.user.is_authenticated and 
                request.user.role in ['FORMATEUR', 'ADMIN'] and 
                request.user.verification_status == 'VERIFIED')

class IsEnrolledStudent(permissions.BasePermission):
    """
    Permission pour les étudiants inscrits à un cours spécifique
    """
    
    def has_object_permission(self, request, view, obj):
        # Vérifier si l'utilisateur est inscrit au cours
        if hasattr(obj, 'course'):
            course = obj.course
        else:
            course = obj
        
        # Les administrateurs et formateurs ont toujours accès
        if request.user.role in ['ADMIN', 'FORMATEUR']:
            return True
        
        # Vérifier si l'étudiant est inscrit au cours
        from courses.models import Enrollment
        return Enrollment.objects.filter(
            user=request.user,
            course=course,
            status='ACTIVE'
        ).exists()

class IsCourseInstructor(permissions.BasePermission):
    """
    Permission pour l'instructeur d'un cours
    """
    
    def has_object_permission(self, request, view, obj):
        # Les administrateurs ont toujours accès
        if request.user.role == 'ADMIN':
            return True
        
        # Vérifier si l'utilisateur est l'instructeur du cours
        if hasattr(obj, 'instructor'):
            return obj.instructor == request.user
        elif hasattr(obj, 'course'):
            return obj.course.instructor == request.user
        
        return False

class IsPublicOrAuthenticated(permissions.BasePermission):
    """
    Permission pour permettre l'accès public ou authentifié selon le contexte
    """
    
    def has_permission(self, request, view):
        # Si c'est une méthode de lecture, permettre l'accès public
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Pour les méthodes d'écriture, nécessiter l'authentification
        return request.user and request.user.is_authenticated

class IsActiveUser(permissions.BasePermission):
    """
    Permission pour vérifier que l'utilisateur est actif
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_active
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated and request.user.is_active

class IsNotBanned(permissions.BasePermission):
    """
    Permission pour vérifier que l'utilisateur n'est pas banni
    """
    
    def has_permission(self, request, view):
        # Vérifier si l'utilisateur a un statut banni
        # À implémenter selon vos besoins
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated

class HasValidSubscription(permissions.BasePermission):
    """
    Permission pour vérifier que l'utilisateur a un abonnement valide
    """
    
    def has_permission(self, request, view):
        # À implémenter selon votre logique d'abonnement
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_authenticated

class CanAccessPremiumContent(permissions.BasePermission):
    """
    Permission pour vérifier l'accès au contenu premium
    """
    
    def has_object_permission(self, request, view, obj):
        # Les administrateurs ont toujours accès
        if request.user.role == 'ADMIN':
            return True
        
        # Vérifier si le contenu est premium
        if hasattr(obj, 'is_premium') and obj.is_premium:
            # Vérifier si l'utilisateur a un abonnement premium
            # À implémenter selon votre logique
            return True
        
        return True

class IsWithinRateLimit(permissions.BasePermission):
    """
    Permission pour vérifier les limites de taux (rate limiting)
    """
    
    def has_permission(self, request, view):
        # À implémenter avec Redis ou un autre système de cache
        # pour limiter le nombre de requêtes par utilisateur
        return True
    
    def has_object_permission(self, request, view, obj):
        return True 