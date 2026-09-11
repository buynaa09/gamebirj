from django.db import migrations

MLBB_RANKS = [
    "Warrior",
    "Elite",
    "Master",
    "Grandmaster",
    "Epic",
    "Legend",
    "Mythic",
    "Mythical Honor",
    "Mythical Glory",
]

# (game_name | None for global, title, placeholder)
SEED_LISTINGS = [
    (None, "Server", "Server / region"),
    (None, "Account Level", "e.g., 60"),
    ("Mobile Legends", "Number of Skins", "e.g., 150"),
    ("Mobile Legends", "Heroes Owned", "e.g., 80"),
    ("Mobile Legends", "Starlight Skins", "e.g., 12"),
    ("Mobile Legends", "Epic+ Skins", "e.g., 30"),
]


def seed(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    GameRank = apps.get_model("games", "GameRank")
    Listing = apps.get_model("games", "Listing")

    mlbb = Game.objects.filter(name="Mobile Legends").first()
    if mlbb is not None:
        for order, name in enumerate(MLBB_RANKS, start=1):
            GameRank.objects.get_or_create(game=mlbb, name=name, defaults={"order": order})

    games_by_name = {g.name: g for g in Game.objects.all()}
    for game_name, title, placeholder in SEED_LISTINGS:
        game = games_by_name.get(game_name) if game_name else None
        if game_name and game is None:
            continue
        Listing.objects.get_or_create(
            game=game,
            title=title,
            defaults={"listing_type": "text", "place_holder_value": placeholder},
        )


def unseed(apps, schema_editor):
    GameRank = apps.get_model("games", "GameRank")
    Listing = apps.get_model("games", "Listing")
    GameRank.objects.filter(name__in=MLBB_RANKS).delete()
    Listing.objects.filter(title__in=[title for _, title, _ in SEED_LISTINGS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0005_gamerank"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
