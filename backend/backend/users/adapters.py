from __future__ import annotations

import typing

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.apps import apps
from django.conf import settings
from django.utils.text import slugify

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
            user.username = self._unique_username(data, sociallogin)
        return user

    def _unique_username(
        self,
        data: dict[str, typing.Any],
        sociallogin: SocialLogin,
    ) -> str:
        email = (data.get("email") or "").strip()
        base = slugify(email.split("@")[0]) if "@" in email else ""
        if not base:
            base = slugify(f"{sociallogin.account.provider}-{sociallogin.account.uid}")
        base = base[:30] or "user"
        user_model = apps.get_model(settings.AUTH_USER_MODEL)
        username = base
        suffix = 0
        while user_model.objects.filter(username__iexact=username).exists():
            suffix += 1
            username = f"{base[:26]}-{suffix}"
        return username
