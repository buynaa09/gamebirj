from ninja import Schema


class GameSchema(Schema):
    id: int
    name: str
    image: str | None = None
