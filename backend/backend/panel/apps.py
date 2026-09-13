from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PanelConfig(AppConfig):
    name = "backend.panel"
    verbose_name = _("Staff Panel")
