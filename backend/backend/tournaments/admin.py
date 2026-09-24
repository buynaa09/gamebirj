from django.contrib import admin

from .bracket import advance_winners
from .models import MLBBMatchConfig
from .models import Tournament
from .models import TournamentMatch
from .models import TournamentRegistration
from .models import TournamentTeam


class TournamentMatchInline(admin.TabularInline):
    model = TournamentMatch
    extra = 0
    fields = [
        "round_index",
        "position",
        "team_a",
        "team_b",
        "winner",
        "score_a",
        "score_b",
        "status",
        "is_expired",
        "mlbb_status",
        "draft_url",
    ]
    readonly_fields = ["is_expired", "mlbb_status", "draft_url"]
    show_change_link = True


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ["title", "game", "status", "starts_at", "is_active"]
    list_editable = ["status", "is_active"]
    search_fields = ["title"]
    list_filter = ["status", "is_active", "game"]
    inlines = [TournamentMatchInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        advance_winners(form.instance)


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


@admin.register(TournamentMatch)
class TournamentMatchAdmin(admin.ModelAdmin):
    list_display = [
        "tournament",
        "round_index",
        "position",
        "team_a",
        "team_b",
        "winner",
        "status",
        "is_expired",
        "mlbb_status",
    ]
    list_filter = ["tournament", "status", "is_expired", "mlbb_status", "round_index"]
    readonly_fields = [
        "mlbb_match_id",
        "mlbb_status",
        "is_expired",
        "battle_data",
        "last_polled_at",
        "draft_url",
        "created_at",
    ]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        advance_winners(obj.tournament)


@admin.register(MLBBMatchConfig)
class MLBBMatchConfigAdmin(admin.ModelAdmin):
    list_display = ["updated_at"]
    fields = ["cookie"]
