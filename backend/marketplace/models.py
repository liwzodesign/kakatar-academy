import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from courses.models import Category
from users.models import User


class Product(models.Model):
    """Produit vendu sur la marketplace : ressource numérique ou prestation."""

    class Type(models.TextChoices):
        TEMPLATE = 'TEMPLATE', _('Template')
        SOURCE_CODE = 'SOURCE_CODE', _('Code source')
        EBOOK = 'EBOOK', _('E-book')
        RESOURCE = 'RESOURCE', _('Ressource')
        COACHING = 'COACHING', _('Coaching')
        SERVICE = 'SERVICE', _('Prestation')

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Brouillon')
        PUBLISHED = 'PUBLISHED', _('Publié')
        ARCHIVED = 'ARCHIVED', _('Archivé')

    DIGITAL_TYPES = {Type.TEMPLATE, Type.SOURCE_CODE, Type.EBOOK, Type.RESOURCE}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    title = models.CharField(_('titre'), max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(_('description'))
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.RESOURCE)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    tags = models.JSONField(default=list, blank=True)

    price = models.DecimalField(_('prix'), max_digits=10, decimal_places=2, default=0,
                                validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='XOF')

    # Ressource numérique : fichier livré après paiement (jamais exposé publiquement)
    file = models.FileField(_('fichier'), upload_to='marketplace/files/', blank=True)
    preview_image = models.ImageField(_('aperçu'), upload_to='marketplace/previews/', blank=True)
    preview_url = models.URLField(_('URL d\'aperçu externe'), blank=True)

    # Prestation
    delivery_days = models.PositiveIntegerField(_('délai de livraison (jours)'), default=3)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    sales_count = models.PositiveIntegerField(default=0)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('produit')
        verbose_name_plural = _('produits')
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or 'produit'
            slug, i = base, 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f'{base}-{i}'
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def is_digital(self):
        return self.type in self.DIGITAL_TYPES

    def update_rating(self):
        agg = self.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        self.rating_average = round(agg['avg'] or 0, 2)
        self.rating_count = agg['count'] or 0
        self.save(update_fields=['rating_average', 'rating_count'])


class Order(models.Model):
    """Commande d'un produit."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', _('En attente de paiement')
        PAID = 'PAID', _('Payée — en cours')
        DELIVERED = 'DELIVERED', _('Livrée')
        COMPLETED = 'COMPLETED', _('Terminée')
        CANCELLED = 'CANCELLED', _('Annulée')
        REFUNDED = 'REFUNDED', _('Remboursée')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='orders')
    payment = models.ForeignKey('payments.Payment', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='orders')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='XOF')

    requirements = models.TextField(_("besoins de l'acheteur"), blank=True)
    delivery_message = models.TextField(_('message de livraison'), blank=True)
    delivery_file = models.FileField(_('fichier livré'), upload_to='marketplace/deliveries/', blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('commande')
        verbose_name_plural = _('commandes')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.product} — {self.buyer} ({self.get_status_display()})'

    def is_paid(self):
        return self.status in (self.Status.PAID, self.Status.DELIVERED, self.Status.COMPLETED)


class ProductReview(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='product_reviews')
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['product', 'user']
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.product.update_rating()
