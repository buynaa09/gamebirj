from django.contrib import admin

from .models import Game
from .models import GameRank
from .models import Listing
from .models import ListingChoice


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active"]
    list_editable = ["is_active"]
    search_fields = ["name"]
    list_filter = ["is_active"]


@admin.register(GameRank)
class GameRankAdmin(admin.ModelAdmin):
    list_display = ["game", "order", "name"]
    list_filter = ["game"]
    ordering = ["game", "order"]


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
