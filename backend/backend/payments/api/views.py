from __future__ import annotations

import logging

from django.http import HttpResponse
from ninja import Router
from ninja.errors import HttpError
from qpay_client.v2 import QPayError

from backend.payments.api.schema import InvoiceRequestSchema
from backend.payments.api.schema import PaymentSchema
from backend.payments.models import Payment
from backend.payments.services import NotPayerError
from backend.payments.services import PaymentClaimError
from backend.payments.services import PaymentError
from backend.payments.services import PaymentNotFoundError
from backend.payments.services import PaymentStateError
from backend.payments.services import cancel_payment
from backend.payments.services import confirm_payment
from backend.payments.services import confirm_payment_by_invoice_no
from backend.payments.services import create_payment_invoice

router = Router(tags=["payments"])

logger = logging.getLogger(__name__)


def _fail(status: int, message: str) -> HttpError:
    return HttpError(status, message)


def _payload(payment: Payment) -> dict:
    return {
        "id": payment.pk,
        "sender_invoice_no": payment.sender_invoice_no,
        "account_id": payment.account_id,
        "kind": payment.kind,
        "duration": payment.duration,
        "amount": float(payment.amount),
        "status": payment.status,
        "invoice_id": payment.qpay_invoice_id,
        "qpay_short_url": payment.qpay_short_url,
        "qpay_qr_text": payment.qpay_qr_text,
        "paid_amount": (
            float(payment.paid_amount) if payment.paid_amount is not None else None
        ),
        "created_at": payment.created_at.isoformat() if payment.created_at else "",
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }


def _payer_payment_or_404(request, payment_id: int) -> Payment:
    payment = Payment.objects.filter(pk=payment_id, user=request.user).first()
    if payment is None:
        raise _fail(404, "Payment not found.")
    return payment


def _map_error(exc: PaymentError) -> HttpError:
    if isinstance(exc, PaymentNotFoundError):
        return _fail(404, str(exc))
    if isinstance(exc, NotPayerError):
        return _fail(403, str(exc))
    if isinstance(exc, PaymentClaimError):
        return HttpError(409, str(exc))
    if isinstance(exc, PaymentStateError):
        return _fail(422, str(exc))
    return _fail(422, str(exc))


@router.post("/qpay/invoice/", response=PaymentSchema)
def create_invoice(request, data: InvoiceRequestSchema):
    try:
        payment = create_payment_invoice(
            data.account_id,
            request.user,
            data.kind,
            data.duration,
        )
    except PaymentError as exc:
        raise _map_error(exc) from exc
    except QPayError as exc:
        logger.exception("QPay invoice_create failed")
        raise _fail(502, f"QPay error: {exc}") from exc
    return _payload(payment)


@router.get("/qpay/callback/", auth=None)
def qpay_callback_get(request, payment_id: str = ""):
    return _handle_callback(payment_id)


@router.post("/qpay/callback/", auth=None)
def qpay_callback_post(request, payment_id: str = ""):
    return _handle_callback(payment_id)


def _handle_callback(sender_invoice_no: str) -> HttpResponse:
    """QPay server-to-server callback. Always 200/SUCCESS once processed.

    Non-200 is reserved for "please retry": unknown payment (404) or a
    transient QPay lookup failure (502). Claim races (409) are final for
    this payment and still acknowledge SUCCESS — staff refunds via QPay.
    """
    if not sender_invoice_no:
        return HttpResponse("MISSING payment_id", status=400)
    try:
        payment = confirm_payment_by_invoice_no(sender_invoice_no)
    except PaymentClaimError as exc:
        logger.warning("QPay callback claim failed: %s", exc)
        return HttpResponse("SUCCESS")
    except (PaymentError, QPayError) as exc:
        logger.exception("QPay callback check failed")
        status = 502 if isinstance(exc, QPayError) else 422
        return HttpResponse(str(exc), status=status)
    if payment is None:
        return HttpResponse("UNKNOWN payment_id", status=404)
    # QPay requires HTTP 200 with body "SUCCESS".
    return HttpResponse("SUCCESS")


@router.get("/qpay/{payment_id}/status/", response=PaymentSchema)
def payment_status(request, payment_id: int):
    payment = _payer_payment_or_404(request, payment_id)
    if payment.status == Payment.PENDING and payment.qpay_invoice_id:
        try:
            payment = confirm_payment(payment)
        except PaymentClaimError as exc:
            raise HttpError(409, str(exc)) from exc
        except QPayError as exc:
            logger.exception("QPay payment_check failed")
            raise _fail(502, f"QPay error: {exc}") from exc
        except PaymentError as exc:
            raise _map_error(exc) from exc
    return _payload(payment)


@router.post("/qpay/{payment_id}/cancel/", response=PaymentSchema)
def payment_cancel(request, payment_id: int):
    payment = _payer_payment_or_404(request, payment_id)
    try:
        payment = cancel_payment(payment, request.user)
    except PaymentError as exc:
        raise _map_error(exc) from exc
    except QPayError as exc:
        logger.exception("QPay invoice_cancel failed")
        raise _fail(502, f"QPay error: {exc}") from exc
    return _payload(payment)


@router.get("/mine/", response=list[PaymentSchema])
def list_my_payments(request):
    payments = Payment.objects.filter(user=request.user).order_by("-created_at", "-id")
    return [_payload(payment) for payment in payments]
