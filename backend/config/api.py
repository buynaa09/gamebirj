from django.contrib.admin.views.decorators import staff_member_required
from ninja import NinjaAPI
from ninja.security import SessionAuth

from backend.users.clerk_auth import ClerkBearer

api = NinjaAPI(
    urls_namespace="api",
    # Clerk JWT (SPA) first, Django session (tests, staff API docs) as fallback.
    auth=[ClerkBearer(), SessionAuth()],
    docs_decorator=staff_member_required,
)

api.add_router("/users/", "backend.users.api.views.router")
api.add_router("/games/", "backend.games.api.views.router")
api.add_router("/accounts/", "backend.accounts.api.views.router")
api.add_router("/chat/", "backend.chat.api.views.router")
