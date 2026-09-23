from datetime import datetime
from datetime import timedelta
from datetime import timezone

from django.db import migrations

MONGOLIA_TZ_OFFSET = 8

SEED_TOURNAMENTS = [
    {
        "game": "Mobile Legends",
        "title": "GameBirj MLBB Cup — Season 1",
        "status": "open",
        "prize_pool": "1,000,000₮",
        "entry_fee": "Үнэгүй",
        "starts_at": datetime(2026, 10, 5, 19, 0),
        "format": "5v5 · Single Elimination",
        "total_slots": 32,
        "filled_slots": 21,
        "slot_unit": "баг",
    },
    {
        "game": "PUBG Mobile",
        "title": "PUBG Mobile Solo Showdown",
        "status": "open",
        "prize_pool": "500,000₮",
        "entry_fee": "10,000₮",
        "starts_at": datetime(2026, 10, 12, 18, 0),
        "format": "Solo · 3 раунд",
        "total_slots": 64,
        "filled_slots": 37,
        "slot_unit": "тоглогч",
    },
    {
        "game": "Valorant",
        "title": "Valorant Community Clash",
        "status": "live",
        "prize_pool": "750,000₮",
        "entry_fee": "20,000₮ / баг",
        "starts_at": None,
        "format": "5v5 · Group + Playoff",
        "total_slots": 16,
        "filled_slots": 16,
        "slot_unit": "баг",
    },
    {
        "game": "Dota 2",
        "title": "Dota 2 Amateur League",
        "status": "open",
        "prize_pool": "300,000₮",
        "entry_fee": "Үнэгүй",
        "starts_at": datetime(2026, 11, 2, 17, 0),
        "format": "5v5 · Double Elimination",
        "total_slots": 16,
        "filled_slots": 6,
        "slot_unit": "баг",
    },
    {
        "game": "EA FC 25",
        "title": "FC 25 Weekend Cup",
        "status": "finished",
        "prize_pool": "200,000₮",
        "entry_fee": "5,000₮",
        "starts_at": datetime(2026, 9, 14, 12, 0),
        "format": "1v1 · Single Elimination",
        "total_slots": 32,
        "filled_slots": 32,
        "slot_unit": "тоглогч",
    },
    {
        "game": "CS2",
        "title": "CS2 2v2 Wingman Night",
        "status": "finished",
        "prize_pool": "150,000₮",
        "entry_fee": "Үнэгүй",
        "starts_at": datetime(2026, 9, 7, 20, 0),
        "format": "2v2 · Wingman",
        "total_slots": 16,
        "filled_slots": 16,
        "slot_unit": "баг",
    },
]


def seed_tournaments(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Tournament = apps.get_model("tournaments", "Tournament")
    ulaanbaatar = timezone(timedelta(hours=MONGOLIA_TZ_OFFSET))
    for entry in SEED_TOURNAMENTS:
        game, _ = Game.objects.get_or_create(name=entry["game"])
        starts_at = entry["starts_at"]
        Tournament.objects.get_or_create(
            title=entry["title"],
            defaults={
                "game": game,
                "status": entry["status"],
                "prize_pool": entry["prize_pool"],
                "entry_fee": entry["entry_fee"],
                "starts_at": starts_at.replace(tzinfo=ulaanbaatar)
                if starts_at
                else None,
                "format": entry["format"],
                "total_slots": entry["total_slots"],
                "filled_slots": entry["filled_slots"],
                "slot_unit": entry["slot_unit"],
            },
        )


def unseed_tournaments(apps, schema_editor):
    Tournament = apps.get_model("tournaments", "Tournament")
    Tournament.objects.filter(
        title__in=[entry["title"] for entry in SEED_TOURNAMENTS],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tournaments", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_tournaments, unseed_tournaments),
    ]
