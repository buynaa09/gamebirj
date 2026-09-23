from django.db import migrations, models


def copy_is_active(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(is_active=False).update(
        is_active_marketplace=False,
        is_active_tournament=False,
    )


def uncopy_is_active(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(is_active_marketplace=False).update(is_active=False)
    Game.objects.filter(is_active_tournament=False).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0007_game_is_active'),
    ]

    operations = [
        migrations.AddField(
            model_name='game',
            name='is_active_marketplace',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='game',
            name='is_active_tournament',
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(copy_is_active, uncopy_is_active),
        migrations.RemoveField(
            model_name='game',
            name='is_active',
        ),
    ]
