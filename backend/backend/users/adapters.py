from __future__ import annotations

import logging
import time
import typing
import uuid

import urllib3.util.connection as urllib3_cn
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.apps import apps
from django.conf import settings
from django.utils.text import slugify

# Force urllib3 / requests to resolve IPv4 addresses only.
# On cloud VMs (such as Oracle Cloud Infrastructure), outbound IPv6 traffic
# is dropped by default VCN routing, causing TCP connect attempts to hang
# for ~21 seconds (SYN retransmits) before falling back to IPv4.
urllib3_cn.HAS_IPV6 = False

logger = logging.getLogger(__name__)

if typing.TYPE_CHECKING:
    from allauth.socialaccount.models import SocialLogin
    from django.http import HttpRequest

    from backend.users.models import User


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        return getattr(settings, "ACCOUNT_ALLOW_REGISTRATION", True)


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(
        self,
        request: HttpRequest,
        sociallogin: SocialLogin,
    ) -> bool:
        return getattr(settings, "ACCOUNT_ALLOW_REGISTRATION", True)

    def on_authentication_error(
        self,
        request: HttpRequest,
        provider,
        error=None,
        exception=None,
        extra_context=None,
    ) -> None:
        # allauth's default hook is a no-op and its error page hides the
        # cause, so log everything needed to diagnose silent 401s. No
        # secrets are logged (exceptions carry error codes, not tokens;
        # only the presence of single-use params is recorded, never values).
        params = request.GET
        logger.error(
            "Social login failed: provider=%s error=%s exception=%r "
            "provider_error=%s provider_error_description=%s "
            "provider_error_reason=%s has_state_id=%s",
            getattr(provider, "id", provider),
            error,
            exception,
            params.get("error"),
            params.get("error_description"),
            params.get("error_reason"),
            "state" in params,
        )

    def get_requests_session(self):
        session = super().get_requests_session()
        orig_request = session.request

        def logging_request(method, url, **kwargs):
            # Enforce connect and read timeouts (5s connect, 10s read) so
            # outbound OAuth calls can never hang indefinitely.
            kwargs.setdefault("timeout", (5.0, 10.0))

            is_oauth_call = any(
                marker in url
                for marker in ("oauth2", "token", "graph.facebook", "googleapis")
            )
            _min_mask_len = 8
            if is_oauth_call:
                data = dict(kwargs.get("data") or {})
                safe = {}
                for key, value in data.items():
                    if key == "code" and isinstance(value, str):
                        # Mask code while revealing ends/length to detect code reuse
                        # across retry requests without leaking full grant.
                        safe[key] = (
                            f"{value[:4]}...{value[-4:]}(len={len(value)})"
                            if len(value) > _min_mask_len
                            else "<code_present>"
                        )
                    elif key in {
                        "client_secret",
                        "code_verifier",
                        "refresh_token",
                    }:
                        safe[key] = "<redacted>"
                    else:
                        safe[key] = value

                logger.error(
                    "Social token request: %s %s data=%s timeout=%s",
                    method,
                    url,
                    safe,
                    kwargs.get("timeout"),
                )

            t0 = time.monotonic()
            try:
                resp = orig_request(method, url, **kwargs)
            except Exception:
                elapsed = time.monotonic() - t0
                if is_oauth_call:
                    logger.exception(
                        "Social token call failed [%.2fs]: %s",
                        elapsed,
                        url,
                    )
                raise
            else:
                elapsed = time.monotonic() - t0
                if is_oauth_call:
                    body_preview = (resp.text or "")[:200].replace("\n", " ")
                    logger.error(
                        "Social token response [%.2fs]: %s status=%d body=%s",
                        elapsed,
                        url,
                        resp.status_code,
                        body_preview,
                    )
                return resp

        session.request = logging_request
        return session

    def populate_user(
        self,
        request: HttpRequest,
        sociallogin: SocialLogin,
        data: dict[str, typing.Any],
    ) -> User:
        """
        Populates user information from social provider info.

        Auto-derives a unique username from the provider email so
        SOCIALACCOUNT_AUTO_SIGNUP never fails on the required field.

        See: https://docs.allauth.org/en/latest/socialaccount/advanced.html#creating-and-populating-user-instances
        """
        user = super().populate_user(request, sociallogin, data)
        if not user.name:
            if name := data.get("name"):
                user.name = name
            elif first_name := data.get("first_name"):
                user.name = first_name
                if last_name := data.get("last_name"):
                    user.name += f" {last_name}"
        if not user.username:
            try:
                user.username = self._unique_username(data, sociallogin)
            except Exception:
                # Never let username derivation 500 the OAuth callback —
                # fall back to a random handle and log the real cause.
                logger.exception("Failed to derive social username, using fallback")
                user.username = f"user-{uuid.uuid4().hex[:12]}"
        return user

    def _unique_username(
        self,
        data: dict[str, typing.Any],
        sociallogin: SocialLogin,
    ) -> str:
        email = (data.get("email") or "").strip()
        base = slugify(email.split("@")[0]) if "@" in email else ""
        if not base:
            account = getattr(sociallogin, "account", None)
            provider = getattr(account, "provider", "social") or "social"
            uid = getattr(account, "uid", "") or uuid.uuid4().hex[:8]
            base = slugify(f"{provider}-{uid}")
        base = base[:30] or "user"
        user_model = apps.get_model(settings.AUTH_USER_MODEL)
        username = base
        suffix = 0
        while user_model.objects.filter(username__iexact=username).exists():
            suffix += 1
            username = f"{base[:26]}-{suffix}"
        return username
