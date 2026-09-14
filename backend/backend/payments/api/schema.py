from ninja import Schema


class InvoiceRequestSchema(Schema):
    account_id: int
    kind: str = "sale"
    duration: int = 1


class QPayBankSchema(Schema):
    """One bank deeplink from QPay invoice_create `urls`."""

    name: str
    description: str = ""
    logo: str = ""
    link: str = ""


class PaymentSchema(Schema):
    id: int
    sender_invoice_no: str
    account_id: int
    kind: str
    duration: int
    amount: float
    status: str
    invoice_id: str = ""
    qpay_short_url: str = ""
    qpay_qr_text: str = ""
    qpay_qr_image: str = ""
    banks: list[QPayBankSchema] = []
    paid_amount: float | None = None
    created_at: str = ""
    paid_at: str | None = None
