from django.urls import reverse
from ninja import ModelSchema
from ninja import Schema

from backend.users.models import User


class BankAccountSchema(Schema):
    bank_id: int | None = None
    bank_name: str = ""
    bank_logo: str = ""
    account_holder: str = ""
    account_number: str = ""


class BankAccountUpdateSchema(Schema):
    bank_id: int | None = None
    account_holder: str = ""
    account_number: str = ""


class UpdateUserSchema(ModelSchema):
    class Meta:
        model = User
        fields = ["username", "name"]


class UserSchema(ModelSchema):
    url: str

    class Meta:
        model = User
        fields = ["id", "username", "email", "name"]

    @staticmethod
    def resolve_url(obj: User):
        return reverse("api:retrieve_user", kwargs={"username": obj.username})
