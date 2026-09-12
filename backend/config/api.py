from django.contrib.admin.views.decorators import staff_member_required
from ninja import NinjaAPI
from ninja.security import SessionAuth

api = NinjaAPI(
    urls_namespace="api",
    auth=SessionAuth(),
    docs_decorator=staff_member_required,
)

api.add_router("/users/", "backend.users.api.views.router")
api.add_router("/users/auth/", "backend.users.api.auth.router")
api.add_router("/games/", "backend.games.api.views.router")
api.add_router("/accounts/", "backend.accounts.api.views.router")
api.add_router("/chat/", "backend.chat.api.views.router")
