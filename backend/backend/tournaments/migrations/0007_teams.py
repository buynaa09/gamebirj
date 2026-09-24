from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def carry_registrations_to_teams(apps, schema_editor):
    TournamentTeam = apps.get_model("tournaments", "TournamentTeam")
    TournamentRegistration = apps.get_model("tournaments", "TournamentRegistration")
    for registration in TournamentRegistration.objects.select_related("tournament", "user"):
        team, _ = TournamentTeam.objects.get_or_create(
            game_id=registration.tournament.game_id,
            name=registration.team_name,
            defaults={
                "owner_id": registration.user_id,
                "leader_game_id": registration.leader_game_id,
                "leader_server_id": registration.leader_server_id,
                "leader_nickname": registration.leader_nickname,
            },
        )
        registration.team = team
        registration.save(update_fields=["team"])


def drop_carried_teams(apps, schema_editor):
    TournamentTeam = apps.get_model("tournaments", "TournamentTeam")
    TournamentTeam.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tournaments", "0006_backfill_details"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("leader_game_id", models.CharField(max_length=100)),
                ("leader_server_id", models.CharField(blank=True, default="", max_length=100)),
                ("leader_nickname", models.CharField(blank=True, default="", max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tournament_teams", to="games.game")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tournament_teams", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=["game", "name"], name="unique_team_name_per_game"),
                    models.UniqueConstraint(fields=["game", "owner"], name="unique_team_per_game_owner"),
                ],
            },
        ),
        migrations.AddField(
            model_name="tournamentregistration",
            name="team",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="registrations", to="tournaments.tournamentteam"),
        ),
        migrations.RunPython(carry_registrations_to_teams, drop_carried_teams),
        migrations.RemoveConstraint(
            model_name="tournamentregistration",
            name="unique_team_per_tournament",
        ),
        migrations.RemoveConstraint(
            model_name="tournamentregistration",
            name="unique_user_per_tournament",
        ),
        migrations.RemoveField(
            model_name="tournamentregistration",
            name="leader_game_id",
        ),
        migrations.RemoveField(
            model_name="tournamentregistration",
            name="leader_nickname",
        ),
        migrations.RemoveField(
            model_name="tournamentregistration",
            name="leader_server_id",
        ),
        migrations.RemoveField(
            model_name="tournamentregistration",
            name="team_name",
        ),
        migrations.AlterField(
            model_name="tournamentregistration",
            name="team",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="registrations", to="tournaments.tournamentteam"),
        ),
        migrations.AddConstraint(
            model_name="tournamentregistration",
            constraint=models.UniqueConstraint(fields=["tournament", "team"], name="unique_team_registration"),
        ),
        migrations.AddConstraint(
            model_name="tournamentregistration",
            constraint=models.UniqueConstraint(fields=["tournament", "user"], name="unique_user_registration"),
        ),
    ]
