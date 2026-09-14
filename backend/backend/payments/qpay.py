"""QPay client construction from Django settings.

Never call ``QPaySettings()`` directly — use :func:`get_qpay_settings`,
which picks the ``sandbox()`` or ``production()`` factory from env.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from qpay_client.v2 import QPayClient
from qpay_client.v2 import QPaySettings


def _retry_kwargs() -> dict[str, Any]:
    return {
        "client_retries": settings.QPAY_CLIENT_RETRIES,
        "client_delay": settings.QPAY_CLIENT_DELAY,
        "client_jitter": settings.QPAY_CLIENT_JITTER,
        "payment_check_retries": settings.QPAY_PAYMENT_CHECK_RETRIES,
        "payment_check_delay": settings.QPAY_PAYMENT_CHECK_DELAY,
        "payment_check_jitter": settings.QPAY_PAYMENT_CHECK_JITTER,
    }


def get_qpay_settings() -> QPaySettings:
    """Build immutable QPay settings from Django settings / env."""
    if settings.QPAY_USE_SANDBOX:
        overrides: dict[str, Any] = {}
        if settings.QPAY_USERNAME:
            overrides["username"] = settings.QPAY_USERNAME
        if settings.QPAY_PASSWORD:
            overrides["password"] = settings.QPAY_PASSWORD
        if settings.QPAY_INVOICE_CODE:
            overrides["invoice_code"] = settings.QPAY_INVOICE_CODE
        return QPaySettings.sandbox(**overrides, **_retry_kwargs())
    if not (
        settings.QPAY_USERNAME and settings.QPAY_PASSWORD and settings.QPAY_INVOICE_CODE
    ):
        msg = (
            "QPAY_USERNAME, QPAY_PASSWORD and QPAY_INVOICE_CODE must all be set "
            "when QPAY_USE_SANDBOX=False. See .envs/.production/.qpay."
        )
        raise ImproperlyConfigured(msg)
    return QPaySettings.production(
        username=settings.QPAY_USERNAME,
        password=settings.QPAY_PASSWORD,
        invoice_code=settings.QPAY_INVOICE_CODE,
        **_retry_kwargs(),
    )


@lru_cache(maxsize=1)
def _cached_settings() -> QPaySettings:
    return get_qpay_settings()


def get_qpay_client() -> QPayClient:
    """Return a sync QPay client (Ninja views run under sync workers)."""
    return QPayClient(settings=_cached_settings())
