from ninja import Schema


class GameListingSchema(Schema):
    id: int
    title: str
    listing_type: str
    place_holder_value: str | None = None
    choices: list[str] = []


class GameSchema(Schema):
    id: int
    name: str
    image: str | None = None
    ranks: list[str] = []
    listings: list[GameListingSchema] = []
