from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "sender_invoice_no",
        "account",
        "user",
        "kind",
        "amount",
        "status",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "kind")
    search_fields = (
        "sender_invoice_no",
        "qpay_invoice_id",
        "account__title",
        "user__username",
    )
    readonly_fields = (
        "sender_invoice_no",
        "qpay_invoice_id",
        "qpay_short_url",
        "qpay_qr_text",
        "qpay_qr_image",
        "qpay_urls",
        "paid_amount",
        "raw_callback",
        "created_at",
        "updated_at",
        "paid_at",
    )
