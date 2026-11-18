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
        
        # L'administrateur et l'instructeur du cours ont toujours accès
        if request.user.role == 'ADMIN' or getattr(course, 'instructor_id', None) == request.user.id:
            return True
        
        # Vérifier si l'étudiant est inscrit au cours
        from courses.models import Enrollment
        return Enrollment.objects.filter(
            user=request.user,
            course=course,
            status__in=['ACTIVE', 'COMPLETED']
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
        if hasattr(obj, 'course'):
            return obj.course.instructor == request.user
        if hasattr(obj, 'module'):
            return obj.module.course.instructor == request.user
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
        return bool(request.user and request.user.is_authenticated and not request.user.is_banned)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class HasValidSubscription(permissions.BasePermission):
    """
    Permission pour vérifier que l'utilisateur a un abonnement valide
    """
    
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == 'ADMIN':
            return True
        from payments.models import Subscription
        return Subscription.objects.active_for(request.user).exists()

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class CanAccessPremiumContent(permissions.BasePermission):
    """
    Permission pour vérifier l'accès au contenu premium
    """
    
    def has_object_permission(self, request, view, obj):
        # Les administrateurs ont toujours accès
        if request.user.role == 'ADMIN':
            return True
        
        # Vérifier si le contenu est premium
        if getattr(obj, 'is_premium', False):
            from payments.models import Subscription
            return Subscription.objects.active_for(request.user).filter(
                plan__in=['PREMIUM', 'ENTERPRISE']).exists()
        return True

# NB : la limitation de débit est assurée par les throttles DRF
# (voir REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] dans settings.py). 