from django.conf import settings
from django.db import models


class Payment(models.Model):
    """A QPay invoice for one listing purchase (sale) or rental.

    Pay-then-claim: the listing is claimed via ``buy_account`` /
    ``rent_account`` only after QPay confirms the money (callback or
    status poll). Until then the listing stays ``available``.
    """

    SALE = "sale"
    RENT = "rent"
    KIND_CHOICES = [
        (SALE, "Sale"),
        (RENT, "Rent"),
    ]

    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (PAID, "Paid"),
        (FAILED, "Failed"),
        (EXPIRED, "Expired"),
        (CANCELLED, "Cancelled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="payments",
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=SALE)
    duration = models.PositiveIntegerField(default=1)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # Our idempotency key: sent as QPay ``sender_invoice_no`` and echoed
    # back in ``callback_url ?payment_id=``.
    sender_invoice_no = models.CharField(max_length=45, unique=True, db_index=True)
    qpay_invoice_id = models.CharField(max_length=50, blank=True, default="")
    qpay_short_url = models.URLField(max_length=500, blank=True, default="")
    qpay_qr_text = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=PENDING,
        db_index=True,
    )
    paid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    raw_callback = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.sender_invoice_no} ({self.amount} — {self.status})"

    @property
    def is_pending(self) -> bool:
        return self.status == self.PENDING
