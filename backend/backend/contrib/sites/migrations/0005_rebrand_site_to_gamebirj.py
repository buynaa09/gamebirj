"""Rebrand the default site from Soliltsoo to GameBirj."""

from django.conf import settings
from django.db import migrations


def update_site_forward(apps, schema_editor):
    """Set site domain and name to gamebirj.com / GameBirj."""
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        id=settings.SITE_ID,
        defaults={
            "domain": "gamebirj.com",
            "name": "GameBirj",
        },
    )


def update_site_backward(apps, schema_editor):
    """Revert site domain and name to soliltsoo.com / Soliltsoo."""
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        id=settings.SITE_ID,
        defaults={
            "domain": "soliltsoo.com",
            "name": "Soliltsoo",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("sites", "0003_set_site_domain_and_name"),
        ("sites", "0004_alter_options_ordering_domain"),
    ]

    operations = [migrations.RunPython(update_site_forward, update_site_backward)]
