from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to="game_images/", blank=True, null=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class 