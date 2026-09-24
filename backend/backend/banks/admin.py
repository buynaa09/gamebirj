from django.contrib import admin

from .models import Bank


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active"]
    list_editable = ["is_active"]
    search_fields = ["name", "description"]
    list_filter = ["is_active"]
