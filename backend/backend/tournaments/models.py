from django.conf import settings
from django.db import models


class Tournament(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open for registration"
        LIVE = "live", "Live"
        FINISHED = "finished", "Finished"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="tournaments",
    )
    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.OPEN,
    )
    prize_pool = models.CharField(max_length=100)
    entry_fee = models.CharField(max_length=100, default="Үнэгүй")
    starts_at = models.DateTimeField(blank=True, null=True)
    ends_at = models.DateTimeField(blank=True, null=True)
    format = models.CharField(max_length=100, blank=True)
    mode = models.CharField(max_length=20, default="Online")
    team_size = models.PositiveIntegerField(default=5)
    rules = models.TextField(blank=True, default="")
    total_slots = models.PositiveIntegerField(default=16)
    filled_slots = models.PositiveIntegerField(default=0)
    slot_unit = models.CharField(max_length=20, default="баг")  # noqa: RUF001 — Mongolian word for "team"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]

    def __str__(self):
        return f"{self.title} ({self.game})"


class TournamentTeam(models.Model):
    """A reusable player team for one game.

    A user creates a team once (leader ID verified at creation) and then
    registers it into any tournament of the same game without re-creating.
    """

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="tournament_teams",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tournament_teams",
    )
    name = models.CharField(max_length=100)
    leader_game_id = models.CharField(max_length=100)
    leader_server_id = models.CharField(max_length=100, blank=True, default="")
    # Nickname snapshot from the ID check at team creation time.
    leader_nickname = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["game", "name"],
                name="unique_team_name_per_game",
            ),
            models.UniqueConstraint(
                fields=["game", "owner"],
                name="unique_team_per_game_owner",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.game})"


class TournamentRegistration(models.Model):
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tournament_registrations",
    )
    team = models.ForeignKey(
        TournamentTeam,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "team"],
                name="unique_team_registration",
            ),
            models.UniqueConstraint(
                fields=["tournament", "user"],
                name="unique_user_registration",
            ),
        ]

    def __str__(self):
        return f"{self.team.name} ({self.tournament})"


class MLBBMatchConfig(models.Model):
    """Singleton holding the matchTools browser cookie.

    The ``acw_tc`` cookie is pasted from a browser session and can expire at
    any time, so it lives in the database (editable in admin) instead of env.
    """

    cookie = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"MLBB matchTools config (updated {self.updated_at})"

    @classmethod
    def get_cookie(cls) -> str:
        config = cls.objects.order_by("-updated_at").first()
        return config.cookie.strip() if config else ""


class TournamentMatch(models.Model):
    """One bracket fixture. Rooms (MLBB lobbies) are created automatically
    once both teams are known; results are polled from matchTools every
    minute (``poll_match_results``), with staff as fallback for ambiguous
    outcomes."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending (teams or room TBD)"
        OPEN = "open", "Room open"
        LIVE = "live", "Match in progress"
        EXPIRED = "expired", "Deadline expired"
        FINISHED = "finished", "Finished"

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name="matches",
    )
    round_index = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(default=0)
    team_a = models.ForeignKey(
        TournamentTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches_as_a",
    )
    team_b = models.ForeignKey(
        TournamentTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches_as_b",
    )
    winner = models.ForeignKey(
        TournamentTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches_won",
    )
    mlbb_match_id = models.CharField(max_length=100, blank=True, default="")
    draft_url = models.CharField(max_length=500, blank=True, default="")
    lobby_deadline = models.DateTimeField(null=True, blank=True)
    # Raw matchTools room state (create/room/battle/result) from polling.
    mlbb_status = models.CharField(max_length=20, blank=True, default="")
    last_polled_at = models.DateTimeField(null=True, blank=True)
    # Audit snapshot of the last battleData payload (win_camp, player_list).
    battle_data = models.JSONField(default=dict, blank=True)
    # Result (set by staff until result polling lands). A match with a
    # winner is treated as finished and shows up in match history.
    score_a = models.PositiveIntegerField(null=True, blank=True)
    score_b = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    is_expired = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["round_index", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "round_index", "position"],
                name="unique_match_per_round_position",
            ),
        ]

    def __str__(self):
        return f"{self.tournament.title} R{self.round_index} M{self.position}"

    @property
    def both_teams_known(self) -> bool:
        return self.team_a_id is not None and self.team_b_id is not None
