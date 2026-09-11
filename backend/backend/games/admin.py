from django.contrib import admin

from .models import Game, Listing, ListingChoice

@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ["title", "listing_type"]
    search_fields = ["title"]
    list_filter = ["listing_type"]


@admin.register(ListingChoice)
class ListingChoiceAdmin(admin.ModelAdmin):
    list_display = ["listing", "choice_value"]
    search_fields = ["choice_value"]
    list_filter = ["listing"]