from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to="game_images/", blank=True, null=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class Listing(models.Model):
    class ListingType(models.TextChoices):
        TEXT = "text", "Text"
        CHOICE = "choice", "Choice"
    title = models.CharField(max_length=100)
    place_holder_value = models.CharField(max_length=100, blank=True, null=True)
    listing_type = models.CharField(
        max_length=10, choices=ListingType.choices, default=ListingType.TEXT
    )
    


class ListingChoice(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="choices")
    choice_value = models.CharField(max_length=100)

    def __str__(self):
        return self.choice_value