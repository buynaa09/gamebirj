from django.db import models
from django.contrib.auth.models import User
# Create your models here.





class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='account_images/')
    description = models.TextField()
    def __str__(self):
        return f"{self.title} - {self.price}"

class HighlightField(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='highlight_fields')
    field_name = models.CharField(max_length=100)
    field_value = models.CharField(max_length=100)
    def __str__(self):
        return f"{self.field_name}: {self.field_value}"



