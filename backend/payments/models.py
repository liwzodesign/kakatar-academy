from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
import uuid
from django.utils import timezone

from users.models import User
from courses.models import Course


def _reference():
    return 'KA-' + uuid.uuid4().hex[:10].upper()

class Payment(models.Model):
    """Modèle pour les paiements"""
    
    # Statuts de paiement
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('En attente')
        PROCESSING = 'PROCESSING', _('En cours de traitement')
        COMPLETED = 'COMPLETED', _('Terminé')
        FAILED = 'FAILED', _('Échoué')
        CANCELLED = 'CANCELLED', _('Annulé')
        REFUNDED = 'REFUNDED', _('Remboursé')
    
    # Types de paiement
    class Type(models.TextChoices):
        COURSE_PURCHASE = 'COURSE_PURCHASE', _('Achat de cours')
        SUBSCRIPTION = 'SUBSCRIPTION', _('Abonnement')
        RENEWAL = 'RENEWAL', _('Renouvellement')
        UPGRADE = 'UPGRADE', _('Mise à niveau')
        REFUND = 'REFUND', _('Remboursement')
        SESSION_BOOKING = 'SESSION_BOOKING', _('Réservation de session')
        MARKETPLACE_ORDER = 'MARKETPLACE_ORDER', _('Commande marketplace')
        PATH_PURCHASE = 'PATH_PURCHASE', _('Achat de parcours')
        COHORT_ENROLLMENT = 'COHORT_ENROLLMENT', _('Inscription à une cohorte')
    
    # Gateways de paiement
    class Gateway(models.TextChoices):
        STRIPE = 'STRIPE', _('Stripe')
        PAYDUNYA = 'PAYDUNYA', _('PayDunya')
        WAVE = 'WAVE', _('Wave')
        MOBILE_MONEY = 'MOBILE_MONEY', _('Mobile Money')
        BANK_TRANSFER = 'BANK_TRANSFER', _('Virement bancaire')
    
    # ID unique
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Informations de base
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name=_('utilisateur')
    )
    amount = models.DecimalField(
        _('montant'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    currency = models.CharField(_('devise'), max_length=3, default='XOF')
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.COURSE_PURCHASE,
        verbose_name=_('type')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('statut')
    )
    
    # Référence interne (communiquée aux passerelles)
    reference = models.CharField(_('référence'), max_length=20, unique=True, default=_reference, editable=False)
    checkout_url = models.URLField(_('URL de paiement'), max_length=1000, blank=True)

    # Gateway et référence
    gateway = models.CharField(
        max_length=20,
        choices=Gateway.choices,
        verbose_name=_('gateway de paiement')
    )
    is_sandbox = models.BooleanField(_('paiement simulé (sandbox)'), default=False)
    gateway_transaction_id = models.CharField(
        _('ID de transaction gateway'),
        max_length=255,
        blank=True
    )
    gateway_response = models.JSONField(
        _('réponse du gateway'),
        default=dict,
        blank=True
    )
    
    # Métadonnées
    description = models.TextField(_('description'), blank=True)
    metadata = models.JSONField(_('métadonnées'), default=dict, blank=True)
    
    # Dates
    created_at = models.DateTimeField(_('date de création'), auto_now_add=True)
    updated_at = models.DateTimeField(_('date de modification'), auto_now=True)
    completed_at = models.DateTimeField(_('date de finalisation'), null=True, blank=True)
    
    # Erreurs
    error_message = models.TextField(_('message d\'erreur'), blank=True)
    retry_count = models.PositiveIntegerField(_('nombre de tentatives'), default=0)
    
    class Meta:
        verbose_name = _('paiement')
        verbose_name_plural = _('paiements')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['gateway', 'gateway_transaction_id']),
            models.Index(fields=['user', 'status']),
        ]
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.amount} {self.currency} ({self.get_status_display()})"
    
    def get_amount_display(self):
        """Retourne le montant formaté avec la devise"""
        return f"{self.amount} {self.currency}"
    
    def is_successful(self):
        """Vérifie si le paiement a réussi"""
        return self.status == self.Status.COMPLETED
    
    def can_retry(self):
        """Vérifie si le paiement peut être retenté"""
        return self.status in [self.Status.FAILED, self.Status.CANCELLED] and self.retry_count < 3

class CoursePurchase(models.Model):
    """Modèle pour les achats de cours"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name='course_purchase',
        verbose_name=_('paiement')
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='purchases',
        verbose_name=_('cours')
    )
    
    # Prix et remises
    original_price = models.DecimalField(
        _('prix original'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    final_price = models.DecimalField(
        _('prix final'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    discount_amount = models.DecimalField(
        _('montant de la remise'),
        max_digits=10,
        decimal_places=2,
        default=0
    )
    discount_percentage = models.DecimalField(
        _('pourcentage de remise'),
        max_digits=5,
        decimal_places=2,
        default=0
    )
    
    # Codes promo
    coupon_code = models.CharField(_('code promo'), max_length=50, blank=True)
    coupon_discount = models.DecimalField(
        _('remise coupon'),
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('achat de cours')
        verbose_name_plural = _('achats de cours')
        unique_together = ['payment', 'course']
    
    def __str__(self):
        return f"{self.course.title} - {self.payment.user.get_full_name()}"
    
    def get_total_discount(self):
        """Calcule la remise totale"""
        return self.discount_amount + self.coupon_discount

class SubscriptionQuerySet(models.QuerySet):
    def active_for(self, user):
        now = timezone.now()
        return self.filter(user=user, status='ACTIVE', start_date__lte=now, end_date__gte=now)


class Subscription(models.Model):
    """Modèle pour les abonnements"""

    objects = SubscriptionQuerySet.as_manager()
    
    # Types d'abonnement
    class Plan(models.TextChoices):
        BASIC = 'BASIC', _('Basique')
        PREMIUM = 'PREMIUM', _('Premium')
        ENTERPRISE = 'ENTERPRISE', _('Entreprise')
    
    # Statuts d'abonnement
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Actif')
        EXPIRED = 'EXPIRED', _('Expiré')
        CANCELLED = 'CANCELLED', _('Annulé')
        SUSPENDED = 'SUSPENDED', _('Suspendu')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        verbose_name=_('utilisateur')
    )
    plan = models.CharField(
        max_length=20,
        choices=Plan.choices,
        default=Plan.BASIC,
        verbose_name=_('plan')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name=_('statut')
    )
    
    # Période
    start_date = models.DateTimeField(_('date de début'))
    end_date = models.DateTimeField(_('date de fin'))
    auto_renew = models.BooleanField(_('renouvellement automatique'), default=True)
    
    # Prix
    monthly_price = models.DecimalField(
        _('prix mensuel'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    total_paid = models.DecimalField(
        _('total payé'),
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('abonnement')
        verbose_name_plural = _('abonnements')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_plan_display()} ({self.get_status_display()})"
    
    def is_active(self):
        """Vérifie si l'abonnement est actif"""
        now = timezone.now()
        return (
            self.status == self.Status.ACTIVE and
            self.start_date <= now <= self.end_date
        )
    
    def days_remaining(self):
        """Calcule le nombre de jours restants"""
        if self.is_active():
            remaining = self.end_date - timezone.now()
            return remaining.days
        return 0

class Coupon(models.Model):
    """Modèle pour les codes promo"""
    
    # Types de remise
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', _('Pourcentage')
        FIXED_AMOUNT = 'FIXED_AMOUNT', _('Montant fixe')
    
    # Statuts
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Actif')
        INACTIVE = 'INACTIVE', _('Inactif')
        EXPIRED = 'EXPIRED', _('Expiré')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(_('code'), max_length=50, unique=True)
    description = models.TextField(_('description'), blank=True)
    
    # Remise
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE,
        verbose_name=_('type de remise')
    )
    discount_value = models.DecimalField(
        _('valeur de la remise'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    # Conditions
    minimum_amount = models.DecimalField(
        _('montant minimum'),
        max_digits=10,
        decimal_places=2,
        default=0
    )
    maximum_discount = models.DecimalField(
        _('remise maximum'),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Limites
    usage_limit = models.PositiveIntegerField(_('limite d\'utilisation'), null=True, blank=True)
    usage_count = models.PositiveIntegerField(_('nombre d\'utilisations'), default=0)
    per_user_limit = models.PositiveIntegerField(_('limite par utilisateur'), default=1)
    
    # Dates
    valid_from = models.DateTimeField(_('valide à partir de'))
    valid_until = models.DateTimeField(_('valide jusqu\'à'))
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Statut
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name=_('statut')
    )
    
    # Formateur qui a créé ce code (limité à ses propres cours) ; vide = code de la plateforme
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='created_coupons')

    # Code personnel (ex. récompense de parrainage) : utilisable uniquement par cet utilisateur
    reserved_for = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='personal_coupons')

    # Applicabilité
    applicable_courses = models.ManyToManyField(
        Course,
        blank=True,
        verbose_name=_('cours applicables')
    )
    applicable_categories = models.ManyToManyField(
        'courses.Category',
        blank=True,
        verbose_name=_('catégories applicables')
    )
    
    class Meta:
        verbose_name = _('code promo')
        verbose_name_plural = _('codes promo')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.code} - {self.get_discount_display()}"

    def get_discount_display(self):
        """« -20 % » ou « -5 000 » (sans décimales inutiles, format français)."""
        value = self.discount_value
        text = f"{int(value):,}".replace(',', ' ') if value == value.to_integral_value()             else f"{value.normalize()}".replace('.', ',')
        return f"-{text} %" if self.discount_type == self.DiscountType.PERCENTAGE else f"-{text}"

    def applies_to(self, course):
        """Le coupon s'applique-t-il à ce cours ? (aucune restriction = tous les cours)"""
        courses = self.applicable_courses.all()
        categories = self.applicable_categories.all()
        if not courses and not categories:
            return True
        return course in courses or course.category in categories
    
    def is_valid(self):
        """Vérifie si le coupon est valide"""
        now = timezone.now()
        return (
            self.status == self.Status.ACTIVE and
            self.valid_from <= now <= self.valid_until and
            (self.usage_limit is None or self.usage_count < self.usage_limit)
        )
    
    def can_use_for_user(self, user):
        """Vérifie si l'utilisateur peut utiliser ce coupon"""
        if not self.is_valid():
            return False
        if self.reserved_for_id and self.reserved_for_id != user.id:
            return False

        # Vérifier la limite par utilisateur
        user_usage = CouponUsage.objects.filter(coupon=self, user=user).count()
        return user_usage < self.per_user_limit
    
    def calculate_discount(self, amount):
        """Calcule la remise pour un montant donné"""
        from decimal import Decimal
        amount = Decimal(amount)
        if amount < self.minimum_amount:
            return Decimal('0')
        
        if self.discount_type == self.DiscountType.PERCENTAGE:
            discount = (amount * self.discount_value) / 100
        else:
            discount = self.discount_value
        
        # Appliquer la limite maximum si définie
        if self.maximum_discount:
            discount = min(discount, self.maximum_discount)

        return min(discount, amount).quantize(Decimal('0.01'))

class CouponUsage(models.Model):
    """Modèle pour l'utilisation des coupons"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.CASCADE,
        related_name='usages',
        verbose_name=_('coupon')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='coupon_usages',
        verbose_name=_('utilisateur')
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='coupon_usage',
        verbose_name=_('paiement')
    )
    
    # Montants
    original_amount = models.DecimalField(
        _('montant original'),
        max_digits=10,
        decimal_places=2
    )
    discount_amount = models.DecimalField(
        _('montant de la remise'),
        max_digits=10,
        decimal_places=2
    )
    final_amount = models.DecimalField(
        _('montant final'),
        max_digits=10,
        decimal_places=2
    )
    
    # Métadonnées
    used_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('utilisation de coupon')
        verbose_name_plural = _('utilisations de coupons')
        unique_together = ['coupon', 'payment']
    
    def __str__(self):
        return f"{self.coupon.code} - {self.user.get_full_name()} - {self.discount_amount}"

class Commission(models.Model):
    """Modèle pour les commissions des formateurs"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='commissions',
        verbose_name=_('paiement')
    )
    instructor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='commissions',
        verbose_name=_('formateur')
    )
    
    # Montants
    total_amount = models.DecimalField(
        _('montant total'),
        max_digits=10,
        decimal_places=2
    )
    commission_rate = models.DecimalField(
        _('taux de commission'),
        max_digits=5,
        decimal_places=2,
        default=15.00  # part plateforme, 15 % par défaut
    )
    commission_amount = models.DecimalField(
        _('montant de la commission'),
        max_digits=10,
        decimal_places=2
    )
    instructor_amount = models.DecimalField(
        _('montant pour le formateur'),
        max_digits=10,
        decimal_places=2
    )
    
    # Demande de versement qui couvre cette commission (réservation)
    payout_request = models.ForeignKey('PayoutRequest', on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='commissions')

    # Statut
    is_paid = models.BooleanField(_('payé'), default=False)
    paid_at = models.DateTimeField(_('date de paiement'), null=True, blank=True)
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('commission')
        verbose_name_plural = _('commissions')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.instructor.get_full_name()} - {self.commission_amount} ({self.get_status_display()})"
    
    def get_status_display(self):
        return 'Payé' if self.is_paid else 'En attente'
    
    def calculate_commission(self):
        """Calcule la commission"""
        self.commission_amount = (self.total_amount * self.commission_rate) / 100
        self.instructor_amount = self.total_amount - self.commission_amount
        self.save(update_fields=['commission_amount', 'instructor_amount']) 

class PayoutRequest(models.Model):
    """Demande de versement d'un formateur : regroupe ses commissions non versées."""

    class Method(models.TextChoices):
        WAVE = 'WAVE', _('Wave')
        ORANGE_MONEY = 'ORANGE_MONEY', _('Orange Money')
        FREE_MONEY = 'FREE_MONEY', _('Free Money')
        BANK_TRANSFER = 'BANK_TRANSFER', _('Virement bancaire')

    class Status(models.TextChoices):
        PENDING = 'PENDING', _('En attente')
        PAID = 'PAID', _('Versé')
        REJECTED = 'REJECTED', _('Refusé')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payout_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='XOF')
    method = models.CharField(max_length=20, choices=Method.choices)
    account = models.CharField(_('numéro ou IBAN'), max_length=64)
    account_name = models.CharField(_('titulaire du compte'), max_length=120)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_note = models.CharField(max_length=300, blank=True)
    transaction_reference = models.CharField(_('référence du virement'), max_length=100, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('demande de versement')
        verbose_name_plural = _('demandes de versement')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.instructor} — {self.amount} {self.currency} ({self.get_status_display()})'
