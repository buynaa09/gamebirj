from django.db import migrations, models


def set_mlbb_redx_slug(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(name="Mobile Legends").update(redx_slug="mobile-legends")


def unset_mlbb_redx_slug(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    Game.objects.filter(name="Mobile Legends").update(redx_slug="")


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0008_split_game_is_active'),
    ]

    operations = [
        migrations.AddField(
            model_name='game',
            name='redx_slug',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.RunPython(set_mlbb_redx_slug, unset_mlbb_redx_slug),
    ]
