from django.contrib import admin

from .models import Tournament
from .models import TournamentRegistration


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ["title", "game", "status", "starts_at", "is_active"]
    list_editable = ["status", "is_active"]
    search_fields = ["title"]
    list_filter = ["status", "is_active", "game"]


@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = ["team_name", "tournament", "leader_game_id", "user", "created_at"]
    search_fields = ["team_name", "leader_game_id"]
    list_filter = ["tournament"]
