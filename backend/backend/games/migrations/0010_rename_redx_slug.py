from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0009_game_redx_slug'),
    ]

    operations = [
        migrations.RenameField(
            model_name='game',
            old_name='redx_slug',
            new_name='id_check_slug',
        ),
    ]
