from ninja import Schema


class BankSchema(Schema):
    id: int
    name: str
    description: str = ""
    logo: str
