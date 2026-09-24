from django.contrib import admin

from .models import Tournament
from .models import TournamentRegistration
from .models import TournamentTeam


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ["title", "game", "status", "starts_at", "is_active"]
    list_editable = ["status", "is_active"]
    search_fields = ["title"]
    list_filter = ["status", "is_active", "game"]


@admin.register(TournamentTeam)
class TournamentTeamAdmin(admin.ModelAdmin):
    list_display = ["name", "game", "owner", "leader_nickname", "created_at"]
    search_fields = ["name", "leader_game_id", "leader_nickname"]
    list_filter = ["game"]


@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = ["team", "tournament", "user", "created_at"]
    search_fields = ["team__name"]
    list_filter = ["tournament"]
