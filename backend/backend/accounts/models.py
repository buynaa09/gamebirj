from django.conf import settings
from django.db import models

from backend.games.models import Game, GameRank, Listing, ListingChoice

# Create your models here.


class Account(models.Model):
    AVAILABLE = "available"
    SOLD = "sold"
    RENTED = "rented"
    STATUS_CHOICES = [
        (AVAILABLE, "Available"),
        (SOLD, "Sold"),
        (RENTED, "Rented"),
    ]

    SALE = "sale"
    RENT = "rent"
    KIND_CHOICES = [
        (SALE, "Sale"),
        (RENT, "Rent"),
    ]

    HOUR = "hour"
    DAY = "day"
    MONTH = "month"
    RENTAL_UNIT_CHOICES = [
        (HOUR, "Hour"),
        (DAY, "Day"),
        (MONTH, "Month"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts"
    )
    title = models.CharField(max_length=100)
    game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True)
    game_rank = models.ForeignKey(
        GameRank, on_delete=models.SET_NULL, null=True, blank=True
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, default="")
    accept_offers = models.BooleanField(default=True)
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=AVAILABLE,
        db_index=True,
    )
    kind = models.CharField(
        max_length=16,
        choices=KIND_CHOICES,
        default=SALE,
        db_index=True,
    )
    rental_unit = models.CharField(  # noqa: DJ001 — sale listings have no unit (not "")
        max_length=16,
        choices=RENTAL_UNIT_CHOICES,
        null=True,
        blank=True,
        default=None,
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchases",
    )
    sold_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    sold_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.price}"

    @property
    def is_sold(self) -> bool:
        return self.status == self.SOLD

    @property
    def is_rented(self) -> bool:
        return self.status == self.RENTED


class AccountListing(models.Model):
    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="listings"
    )
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE)
    value = models.CharField(max_length=255, blank=True, default="")
    choices = models.ManyToManyField(ListingChoice, blank=True)

    def __str__(self):
        return f"{self.account.title} - {self.listing.title}: {self.value}"


class AccountImage(models.Model):
    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="account_images/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.account.title} - image {self.pk}"


class Wishlist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist"
    )
    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="wishlisted_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "account"], name="unique_wishlist_entry"
            )
        ]

    def __str__(self):
        return f"{self.user} ♥ {self.account.title}"


class EscrowTransaction(models.Model):
    """Simulated escrow for an instant buy. No real money moves in v1.

    Exactly one row per sold listing: created atomically with the sale while
    holding the account row lock, so two buyers can never both win.
    """

    HELD = "held"
    RELEASED = "released"
    REFUNDED = "refunded"
    STATUS_CHOICES = [
        (HELD, "Held"),
        (RELEASED, "Released"),
        (REFUNDED, "Refunded"),
    ]

    account = models.OneToOneField(
        Account,
        on_delete=models.CASCADE,
        related_name="escrow",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="escrow_purchases",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="escrow_sales",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=HELD)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Escrow {self.pk} ({self.amount} — {self.status})"


class RentalTransaction(models.Model):
    """A direct rental of a ``kind=rent`` listing.

    One account can be rented many times over its life (unlike escrow,
    which is one-shot), so this is a plain FK with at most one ``active``
    row at a time — enforced in ``rent_account`` under row lock.
    """

    ACTIVE = "active"
    RETURNED = "returned"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (ACTIVE, "Active"),
        (RETURNED, "Returned"),
        (CANCELLED, "Cancelled"),
    ]

    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="rentals",
    )
    renter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rentals_as_renter",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rentals_as_owner",
    )
    unit = models.CharField(max_length=16, choices=Account.RENTAL_UNIT_CHOICES)
    duration = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=ACTIVE)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Rental {self.pk} ({self.total} — {self.status})"
