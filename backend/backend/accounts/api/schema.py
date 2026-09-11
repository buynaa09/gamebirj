from ninja import Schema


class AccountListingSchema(Schema):
    listing_id: int
    title: str
    value: str = ""
    choices: list[str] = []


class AccountImageSchema(Schema):
    id: int
    image: str | None = None


class AccountSchema(Schema):
    id: int
    title: str
    game: str | None = None
    game_rank: str | None = None
    price: float
    description: str = ""
    accept_offers: bool = True
    seller: str = ""
    created_at: str = ""
    listings: list[AccountListingSchema] = []
    images: list[AccountImageSchema] = []
