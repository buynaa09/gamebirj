from django.db import migrations

SEED_GAMES = [
    "Mobile Legends",
    "Roblox",
    "Free Fire",
    "Brawl Stars",
    "League of Legends: Wild Rift",
    "Clash of Clans",
    "COD Mobile",
    "PUBG Mobile",
]


def seed_games(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    for name in SEED_GAMES:
        Game.objects.get_or_create(name=name)


def unseed_games(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(name__in=SEED_GAMES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_games, unseed_games),
    ]
