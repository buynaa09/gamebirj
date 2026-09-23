from django import forms

from backend.games.models import Game
from backend.games.models import GameRank
from backend.games.models import Listing
from backend.games.models import ListingChoice


class BootstrapMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            css = field.widget.attrs.get("class", "")
            field.widget.attrs["class"] = f"{css} form-control".strip()


class GameForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Game
        fields = ["name", "image", "is_active_marketplace", "is_active_tournament"]


class GameRankForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = GameRank
        fields = ["name", "order"]


class ListingForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Listing
        fields = ["game", "title", "listing_type", "place_holder_value"]


class ListingChoiceForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = ListingChoice
        fields = ["choice_value"]
