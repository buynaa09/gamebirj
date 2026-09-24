from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import CharField
from django.urls import reverse
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """
    Default custom user model for GameBirj.
    If adding fields that need to be filled at user signup,
    check forms.SignupForm and forms.SocialSignupForms accordingly.
    """

    # First and last name do not cover name patterns around the globe
    name = CharField(_("Name of User"), blank=True, max_length=255)
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    # Clerk user ID (`sub` claim) for accounts authenticated via Clerk.
    # Null for legacy/staff accounts created before the Clerk migration.
    clerk_id = CharField(
        _("Clerk user ID"),
        max_length=255,
        unique=True,
        null=True,
        blank=True,
    )
    bank = models.ForeignKey(
        "banks.Bank",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    account_holder = CharField(max_length=255, blank=True)
    account_number = CharField(max_length=100, blank=True)

    def get_absolute_url(self) -> str:
        """Get URL for user's detail view.

        Returns:
            str: URL for user detail.

        """
        return reverse("users:detail", kwargs={"username": self.username})
