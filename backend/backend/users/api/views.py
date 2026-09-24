from __future__ import annotations

from typing import TYPE_CHECKING

from django.shortcuts import get_object_or_404
from ninja import Router

from backend.banks.models import Bank
from backend.users.api.schema import BankAccountSchema
from backend.users.api.schema import BankAccountUpdateSchema
from backend.users.api.schema import UpdateUserSchema
from backend.users.api.schema import UserSchema
from backend.users.models import User

if TYPE_CHECKING:
    from django.db.models import QuerySet

router = Router(tags=["users"])


def _get_users_queryset(request) -> QuerySet[User]:
    return User.objects.filter(pk=request.user.pk)


@router.get("/", response=list[UserSchema])
def list_users(request):
    return _get_users_queryset(request)


@router.get("/me/", response=UserSchema)
def retrieve_current_user(request):
    return request.user


def _bank_payload(user: User) -> dict:
    return {
        "bank_id": user.bank_id,
        "bank_name": user.bank.name if user.bank else "",
        "bank_logo": user.bank.logo if user.bank else "",
        "account_holder": user.account_holder,
        "account_number": user.account_number,
    }


@router.get("/me/bank/", response=BankAccountSchema)
def retrieve_bank_account(request):
    return _bank_payload(request.user)


@router.patch("/me/bank/", response=BankAccountSchema)
def update_bank_account(request, data: BankAccountUpdateSchema):
    bank = None
    if data.bank_id is not None:
        bank = get_object_or_404(Bank, pk=data.bank_id, is_active=True)
    user = request.user
    user.bank = bank
    user.account_holder = data.account_holder.strip()
    user.account_number = data.account_number.strip()
    user.save(update_fields=["bank", "account_holder", "account_number"])
    return _bank_payload(user)


@router.get("/{username}/", response=UserSchema)
def retrieve_user(request, username: str):
    users_qs = _get_users_queryset(request)
    return get_object_or_404(users_qs, username=username)


@router.patch("/me/", response=UserSchema)
def update_current_user(request, data: UpdateUserSchema):
    user = request.user
    user.name = data.name
    user.username = data.username
    user.save()
    return user


@router.patch("/{username}/", response=UserSchema)
def update_user(request, username: str, data: UpdateUserSchema):
    users_qs = _get_users_queryset(request)
    user = get_object_or_404(users_qs, username=username)
    user.name = data.name
    user.username = data.username
    user.save()
    return user
