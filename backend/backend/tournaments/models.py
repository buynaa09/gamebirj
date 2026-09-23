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
    format = models.CharField(max_length=100, blank=True)
    total_slots = models.PositiveIntegerField(default=16)
    filled_slots = models.PositiveIntegerField(default=0)
    slot_unit = models.CharField(max_length=20, default="баг")  # noqa: RUF001 — Mongolian word for "team"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]

    def __str__(self):
        return f"{self.title} ({self.game})"


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
    team_name = models.CharField(max_length=100)
    leader_game_id = models.CharField(max_length=100)
    leader_server_id = models.CharField(max_length=100, blank=True, default="")
    # Nickname snapshot from the ID check at registration time.
    leader_nickname = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "team_name"],
                name="unique_team_per_tournament",
            ),
            models.UniqueConstraint(
                fields=["tournament", "user"],
                name="unique_user_per_tournament",
            ),
        ]

    def __str__(self):
        return f"{self.team_name} ({self.tournament})"
