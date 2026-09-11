from django.db import models
from settings.auth.models import User
from backend.games.models import Game, Listing, ListingChoice
# Create your models here.





class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    game = models.ForeignKey(Game, on_delete=models.SET_NULL, null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    def __str__(self):
        return f"{self.title} - {self.price}"


class AccountListing(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="listings")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE)
    value = models.SmallIntegerField(blank=True, null=True)
    choices = models.ManyToManyField(ListingChoice, blank=True)

    def __str__(self):
        return f"{self.account.title} - {self.listing.title}: {self.value}"



