from datetime import timedelta

from django.db import migrations

DEFAULT_RULES = """1. Бүртгүүлсэн багийн бүрэлдэхүүн тэмцээний турш өөрчлөгдөхгүй.
2. Тоглолт эхлэхээс 15 минутын өмнө бэлэн байна.
3. Хууран мэхлэлт, cheat болон зөвшөөрөлгүй гуравдагч програм ашиглахыг хориглоно.
4. Шүүгчийн шийдвэр эцсийнх байна.
5. Шагнал тэмцээн дууссанаас хойш 7 хоногийн дотор олгогдоно."""

BACKFILL = {
    "GameBirj MLBB Cup — Season 1": {"days": 7, "team_size": 5},
    "PUBG Mobile Solo Showdown": {"days": 2, "team_size": 1},
    "Valorant Community Clash": {"days": 5, "team_size": 5},
    "Dota 2 Amateur League": {"days": 14, "team_size": 5},
    "FC 25 Weekend Cup": {"days": 2, "team_size": 1},
    "CS2 2v2 Wingman Night": {"days": 1, "team_size": 2},
}


def backfill_details(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    for title, spec in BACKFILL.items():
        try:
            tournament = Tournament.objects.get(title=title)
        except Tournament.DoesNotExist:
            continue
        if tournament.starts_at and not tournament.ends_at:
            tournament.ends_at = tournament.starts_at + timedelta(days=spec["days"])
        tournament.team_size = spec["team_size"]
        tournament.mode = "Online"
        if not tournament.rules:
            tournament.rules = DEFAULT_RULES
        tournament.save()


def unfill_details(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    Tournament.objects.filter(title__in=list(BACKFILL)).update(
        ends_at=None,
        rules="",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0005_tournament_ends_at_tournament_mode_tournament_rules_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_details, unfill_details),
    ]
