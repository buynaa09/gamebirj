from django.contrib import admin

from .models import Account
from .models import AccountImage
from .models import AccountListing
from .models import EscrowTransaction
from .models import RentalTransaction


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "game",
        "price",
        "user",
        "kind",
        "rental_unit",
        "status",
        "buyer",
        "sold_price",
    )
    search_fields = ("title", "description", "user__username")
    list_filter = ("game", "kind", "status")


@admin.register(AccountListing)
class AccountListingAdmin(admin.ModelAdmin):
    list_display = ("account", "listing", "value")
    search_fields = ("account__title", "listing__title")
    list_filter = ("listing",)


@admin.register(AccountImage)
class AccountImageAdmin(admin.ModelAdmin):
    list_display = ("account", "image", "created_at")
    search_fields = ("account__title",)


@admin.register(EscrowTransaction)
class EscrowTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "account",
        "buyer",
        "seller",
        "amount",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("account__title", "buyer__username", "seller__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RentalTransaction)
class RentalTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "account",
        "renter",
        "owner",
        "unit",
        "duration",
        "total",
        "status",
        "created_at",
    )
    list_filter = ("status", "unit")
    search_fields = ("account__title", "renter__username", "owner__username")
    readonly_fields = ("created_at", "updated_at")
