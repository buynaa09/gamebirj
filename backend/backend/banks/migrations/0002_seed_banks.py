from django.db import migrations

BANKS = [
    {"name": "qPay wallet", "description": "qPay хэтэвч", "logo": "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg"},
    {"name": "Khan bank", "description": "Хаан банк", "logo": "https://qpay.mn/q/logo/khanbank.png"},
    {"name": "State bank 3.0", "description": "Төрийн банк 3.0", "logo": "https://qpay.mn/q/logo/state_3.png"},
    {"name": "Xac bank", "description": "Хас банк", "logo": "https://qpay.mn/q/logo/xacbank.png"},
    {"name": "Trade and Development bank", "description": "TDB online", "logo": "https://qpay.mn/q/logo/tdbbank.png"},
    {"name": "Social Pay", "description": "Голомт банк", "logo": "https://qpay.mn/q/logo/socialpay.png"},
    {"name": "Most money", "description": "МОСТ мони", "logo": "https://qpay.mn/q/logo/most.png"},
    {"name": "National investment bank", "description": "Үндэсний хөрөнгө оруулалтын банк", "logo": "https://qpay.mn/q/logo/nibank.jpeg"},
    {"name": "Chinggis khaan bank", "description": "Чингис Хаан банк", "logo": "https://qpay.mn/q/logo/ckbank.png"},
    {"name": "Capitron bank", "description": "Капитрон банк", "logo": "https://qpay.mn/q/logo/capitronbank.png"},
    {"name": "Bogd bank", "description": "Богд банк", "logo": "https://qpay.mn/q/logo/bogdbank.png"},
    {"name": "Trans bank", "description": "Тээвэр хөгжлийн банк", "logo": "https://qpay.mn/q/logo/transbank.png"},
    {"name": "M bank", "description": "М банк", "logo": "https://qpay.mn/q/logo/mbank.png"},
    {"name": "Ard App", "description": "Ард Апп", "logo": "https://qpay.mn/q/logo/ard.png?v=2"},
    {"name": "Toki App", "description": "Toki App", "logo": "https://qpay.mn/q/logo/tokipay.png"},
    {"name": "Arig bank", "description": "Ариг банк", "logo": "https://qpay.mn/q/logo/arig.png"},
    {"name": "Monpay", "description": "Мон Пэй", "logo": "https://qpay.mn/q/logo/monpay.png"},
    {"name": "Hipay", "description": "Hipay", "logo": "https://qpay.mn/q/logo/hipay.png"},
    {"name": "Happy Pay", "description": "Happy Pay MN", "logo": "https://qpay.mn/q/logo/tdbwallet.png"},
    {"name": "Sono", "description": "Sono", "logo": "https://qpay.mn/q/logo/sono.png"},
    {"name": "PayOn", "description": "PayOn", "logo": "https://qpay.mn/q/logo/payon.png"},
    {"name": "Tino", "description": "Tino", "logo": "https://qpay.mn/q/logo/tino.png"},
    {"name": "Pass.mn", "description": "Pass.mn", "logo": "https://qpay.mn/q/logo/pass.png"},
]


def seed_banks(apps, schema_editor):
    Bank = apps.get_model("banks", "Bank")
    for bank in BANKS:
        Bank.objects.get_or_create(
            name=bank["name"],
            defaults={
                "description": bank["description"],
                "logo": bank["logo"],
                "is_active": True,
            },
        )


def unseed_banks(apps, schema_editor):
    Bank = apps.get_model("banks", "Bank")
    Bank.objects.filter(name__in=[bank["name"] for bank in BANKS]).delete()


class Migration(migrations.Migration):
    dependencies = [("banks", "0001_initial")]

    operations = [migrations.RunPython(seed_banks, unseed_banks)]
