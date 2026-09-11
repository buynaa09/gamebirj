from django.conf import settings
from django.db import models

from backend.games.models import Game, GameRank, Listing, ListingChoice

# Create your models here.


class Account(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts"
    )
    title = models.CharField(max_length=100)
    game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True)
    game_rank = models.ForeignKey(GameRank, on_delete=models.SET_NULL, null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, default="")
    accept_offers = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True,null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.price}"


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
