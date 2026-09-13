from ninja import Schema


class AccountListingSchema(Schema):
    listing_id: int
    title: str
    value: str = ""
    choices: list[str] = []


class AccountImageSchema(Schema):
    id: int
    image: str | None = None


class AccountUpdateSchema(Schema):
    title: str | None = None
    price: str | None = None
    description: str | None = None
    accept_offers: bool | None = None
    game_rank: str | None = None


class AccountSchema(Schema):
    id: int
    title: str
    game: str | None = None
    game_rank: str | None = None
    price: float
    description: str = ""
    accept_offers: bool = True
    seller: str = ""
    status: str = "available"
    kind: str = "sale"
    rental_unit: str | None = None
    sold_price: float | None = None
    created_at: str = ""
    wishlisted: bool = False
    wishlist_count: int = 0
    listings: list[AccountListingSchema] = []
    images: list[AccountImageSchema] = []


class OrderSchema(Schema):
    order_id: int
    account_id: int
    amount: float
    status: str
    sold_at: str


class EscrowStatusSchema(Schema):
    order_id: int
    account_id: int
    amount: float
    status: str
    sold_at: str
    is_buyer: bool = False
    is_seller: bool = False


class RentRequestSchema(Schema):
    duration: int = 1


class RentalOrderSchema(Schema):
    order_id: int
    account_id: int
    unit: str
    duration: int
    unit_price: float
    total: float
    status: str
    start_at: str
    end_at: str
    is_renter: bool = False
    is_owner: bool = False
