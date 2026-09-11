from __future__ import annotations

from django.contrib.auth import authenticate
from django.contrib.auth import login
from django.contrib.auth import logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from ninja import Router
from ninja import Schema
from ninja.errors import HttpError

from backend.users.api.schema import UserSchema
from backend.users.models import User

router = Router(tags=["auth"])


class SignupSchema(Schema):
    username: str
    email: str
    password1: str
    password2: str


class LoginSchema(Schema):
    username: str
    password: str


class OkSchema(Schema):
    ok: bool = True


def _password_mismatch_error() -> HttpError:
    msg = "Passwords do not match."
    return HttpError(422, msg)


def _username_taken_error() -> HttpError:
    msg = "Username is already taken."
    return HttpError(422, msg)


def _email_taken_error() -> HttpError:
    msg = "Email is already registered."
    return HttpError(422, msg)


def _invalid_credentials_error() -> HttpError:
    msg = "Invalid username or password."
    return HttpError(401, msg)


@router.post("/signup/", response=UserSchema, auth=None)
def signup(request, data: SignupSchema):
    if data.password1 != data.password2:
        raise _password_mismatch_error()
    if User.objects.filter(username=data.username).exists():
        raise _username_taken_error()
    if User.objects.filter(email__iexact=data.email).exists():
        raise _email_taken_error()
    try:
        validate_password(data.password1)
    except ValidationError as exc:
        raise HttpError(422, "; ".join(exc.messages)) from exc
    user = User.objects.create_user(
        username=data.username,
        email=data.email,
        password=data.password1,
    )
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return user


@router.post("/login/", response=UserSchema, auth=None)
def login_view(request, data: LoginSchema):
    user = authenticate(request, username=data.username, password=data.password)
    if user is None:
        raise _invalid_credentials_error()
    login(request, user)
    return user


@router.post("/logout/", response=OkSchema, auth=None)
def logout_view(request):
    logout(request)
    return OkSchema(ok=True)
