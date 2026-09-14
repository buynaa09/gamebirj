"""QPay pay-then-claim flow for listings.

Buyers pay a QPay invoice first; the listing is claimed via the existing
``buy_account`` / ``rent_account`` services only after QPay confirms money
(callback or status poll). Until then the listing stays ``available``.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from qpay_client.v2 import QPayError
from qpay_client.v2.enums import ObjectType
from qpay_client.v2.schemas import InvoiceCreateSimpleRequest
from qpay_client.v2.schemas import Offset
from qpay_client.v2.schemas import PaymentCheckRequest

from backend.accounts.models import Account
from backend.accounts.services import MAX_RENTAL_DURATION
from backend.accounts.services import AlreadyRentedError
from backend.accounts.services import AlreadySoldError
from backend.accounts.services import agreed_price_for
from backend.accounts.services import buy_account
from backend.accounts.services import rent_account
from backend.payments.models import Payment
from backend.payments.qpay import get_qpay_client

if TYPE_CHECKING:
    from decimal import Decimal

    from qpay_client.v2 import QPayClient

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    """Base error for QPay payment failures."""


class PaymentNotFoundError(PaymentError):
    """No payment matches the given sender_invoice_no / id."""


class PaymentStateError(PaymentError):
    """Payment is not in a state that allows the action."""


class PaymentClaimError(PaymentError):
    """Money arrived but the listing could not be claimed (needs refund)."""


class NotPayerError(PaymentError):
    """Someone other than the payer tried to act on the payment."""


def _sender_invoice_no(account_id: int, user_id: int) -> str:
    return f"GB-{account_id}-{user_id}-{int(time.time())}"


def _callback_url(sender_invoice_no: str) -> str:
    base = settings.QPAY_CALLBACK_BASE_URL
    return f"{base}/api/payments/qpay/callback/?payment_id={sender_invoice_no}"


def compute_amount(account: Account, user, kind: str, duration: int) -> Decimal:
    """Amount the buyer must pay: agreed offer (sale) or price x duration."""
    if kind == Payment.RENT:
        return account.price * duration
    return agreed_price_for(account, user) or account.price


def _validate_intent(account: Account, user, kind: str, duration: int) -> None:
    if account.user_id == user.pk:
        msg = "You cannot pay for your own listing."
        raise PaymentStateError(msg)
    if account.status != Account.AVAILABLE:
        msg = "Listing is no longer available."
        raise PaymentStateError(msg)
    if kind == Payment.RENT:
        if account.kind != Account.RENT:
            msg = "This listing is not for rent."
            raise PaymentStateError(msg)
        if duration < 1 or duration > MAX_RENTAL_DURATION:
            msg = f"Duration must be between 1 and {MAX_RENTAL_DURATION}."
            raise PaymentStateError(msg)
    elif kind == Payment.SALE:
        if account.kind != Account.SALE:
            msg = "This listing is not for sale."
            raise PaymentStateError(msg)
    else:
        msg = "Kind must be 'sale' or 'rent'."
        raise PaymentStateError(msg)


def create_payment_invoice(
    account_id: int,
    user,
    kind: str = Payment.SALE,
    duration: int = 1,
    client: QPayClient | None = None,
) -> Payment:
    """Create a pending Payment + QPay invoice. Idempotent per pending intent."""
    try:
        account = Account.objects.select_related("user").get(pk=account_id)
    except Account.DoesNotExist as exc:
        msg = "Listing not found."
        raise PaymentNotFoundError(msg) from exc
    _validate_intent(account, user, kind, duration)
    amount = compute_amount(account, user, kind, duration)

    existing = (
        Payment.objects.filter(
            user=user,
            account=account,
            kind=kind,
            duration=duration,
            status=Payment.PENDING,
        )
        .order_by("-created_at")
        .first()
    )
    if existing is not None and existing.amount == amount:
        return existing

    payment = Payment.objects.create(
        user=user,
        account=account,
        kind=kind,
        duration=duration,
        amount=amount,
        sender_invoice_no=_sender_invoice_no(account.pk, user.pk),
    )
    qpay = client or get_qpay_client()
    try:
        invoice = qpay.invoice_create(
            InvoiceCreateSimpleRequest(
                sender_invoice_no=payment.sender_invoice_no,
                invoice_receiver_code=f"user-{user.pk}",
                invoice_description=f"GameBirj #{account.pk} {account.title}"[:255],
                amount=amount,
                callback_url=_callback_url(payment.sender_invoice_no),
            ),
        )
    except QPayError:
        logger.exception("QPay invoice_create failed for payment %s", payment.pk)
        payment.status = Payment.FAILED
        payment.save(update_fields=["status", "updated_at"])
        raise
    payment.qpay_invoice_id = invoice.invoice_id
    payment.qpay_short_url = invoice.qPay_shortUrl
    payment.qpay_qr_text = invoice.qr_text
    payment.save(
        update_fields=[
            "qpay_invoice_id",
            "qpay_short_url",
            "qpay_qr_text",
            "updated_at",
        ],
    )
    return payment


def check_qpay_paid(payment: Payment, client: QPayClient | None = None):
    """Run QPay payment_check for this payment's invoice (polls w/ backoff)."""
    qpay = client or get_qpay_client()
    return qpay.payment_check(
        PaymentCheckRequest(
            object_type=ObjectType.invoice,
            object_id=payment.qpay_invoice_id,
            offset=Offset(page_number=1, page_limit=100),
        ),
    )


def confirm_payment(
    payment: Payment,
    client: QPayClient | None = None,
) -> Payment:
    """Verify money via QPay; on success mark paid and claim the listing.

    Idempotent: already-terminal payments are returned as-is. When money
    arrived but the listing is gone (lost race), the payment is marked
    failed and PaymentClaimError is raised so staff can refund via QPay.
    """
    if payment.status != Payment.PENDING:
        return payment
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked.status != Payment.PENDING:
            return locked
        try:
            result = check_qpay_paid(locked, client=client)
        except QPayError:
            logger.exception("QPay payment_check failed for payment %s", locked.pk)
            raise
        if result.count == 0:
            return locked
        locked.paid_amount = result.paid_amount
        locked.paid_at = timezone.now()
        locked.status = Payment.PAID
        locked.save(update_fields=["paid_amount", "paid_at", "status", "updated_at"])
        try:
            if locked.kind == Payment.RENT:
                rent_account(locked.account_id, locked.user, locked.duration)
            else:
                buy_account(locked.account_id, locked.user)
        except (AlreadySoldError, AlreadyRentedError) as exc:
            locked.status = Payment.FAILED
            locked.save(update_fields=["status", "updated_at"])
            msg = (
                "Payment received but the listing was already taken. "
                "Contact support for a refund."
            )
            raise PaymentClaimError(msg) from exc
        return locked


def confirm_payment_by_invoice_no(
    sender_invoice_no: str,
    client: QPayClient | None = None,
) -> Payment | None:
    """Callback entrypoint: find payment by QPay ?payment_id= and confirm."""
    payment = Payment.objects.filter(sender_invoice_no=sender_invoice_no).first()
    if payment is None:
        return None
    return confirm_payment(payment, client=client)


def cancel_payment(
    payment: Payment,
    user,
    client: QPayClient | None = None,
) -> Payment:
    """Cancel a pending payment: QPay invoice_cancel + mark cancelled."""
    if payment.user_id != user.pk:
        msg = "Only the payer can cancel this payment."
        raise NotPayerError(msg)
    if payment.status != Payment.PENDING:
        msg = f"Payment is already {payment.status}."
        raise PaymentStateError(msg)
    qpay = client or get_qpay_client()
    try:
        if payment.qpay_invoice_id:
            qpay.invoice_cancel(payment.qpay_invoice_id)
    except QPayError:
        logger.exception("QPay invoice_cancel failed for payment %s", payment.pk)
        raise
    payment.status = Payment.CANCELLED
    payment.save(update_fields=["status", "updated_at"])
    return payment
