from django.contrib import admin

from .models import Account, AccountListing


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("title", "game", "price", "user")
    search_fields = ("title", "description", "user__username")
    list_filter = ("game",)

@admin.register(AccountListing)
class AccountListingAdmin(admin.ModelAdmin):
    list_display = ("account", "listing", "value")
    search_fields = ("account__title", "listing__title")
    list_filter = ("listing",)
# Register your models here.
