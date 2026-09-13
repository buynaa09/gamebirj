from django.urls import path

from backend.panel.views import AccountDeleteView
from backend.panel.views import AccountDetailView
from backend.panel.views import AccountListView
from backend.panel.views import AccountToggleOffersView
from backend.panel.views import ConversationDetailView
from backend.panel.views import ConversationListView
from backend.panel.views import DashboardView
from backend.panel.views import GameCreateView
from backend.panel.views import GameDetailView
from backend.panel.views import GameListView
from backend.panel.views import GameRankCreateView
from backend.panel.views import GameRankDeleteView
from backend.panel.views import GameUpdateView
from backend.panel.views import ListingChoiceCreateView
from backend.panel.views import ListingChoiceDeleteView
from backend.panel.views import ListingCreateView
from backend.panel.views import ListingDeleteView
from backend.panel.views import ListingDetailView
from backend.panel.views import ListingUpdateView
from backend.panel.views import TransactionListView
from backend.panel.views import UserDetailView
from backend.panel.views import UserListView
from backend.panel.views import UserToggleActiveView
from backend.panel.views import UserToggleStaffView

app_name = "panel"

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path("users/", UserListView.as_view(), name="user_list"),
    path("users/<str:username>/", UserDetailView.as_view(), name="user_detail"),
    path(
        "users/<str:username>/toggle-active/",
        UserToggleActiveView.as_view(),
        name="user_toggle_active",
    ),
    path(
        "users/<str:username>/toggle-staff/",
        UserToggleStaffView.as_view(),
        name="user_toggle_staff",
    ),
    path("accounts/", AccountListView.as_view(), name="account_list"),
    path("accounts/<int:pk>/", AccountDetailView.as_view(), name="account_detail"),
    path(
        "accounts/<int:pk>/delete/",
        AccountDeleteView.as_view(),
        name="account_delete",
    ),
    path(
        "accounts/<int:pk>/toggle-offers/",
        AccountToggleOffersView.as_view(),
        name="account_toggle_offers",
    ),
    path("transactions/", TransactionListView.as_view(), name="transaction_list"),
    path("games/", GameListView.as_view(), name="game_list"),
    path("games/add/", GameCreateView.as_view(), name="game_add"),
    path("games/<int:pk>/", GameDetailView.as_view(), name="game_detail"),
    path("games/<int:pk>/edit/", GameUpdateView.as_view(), name="game_edit"),
    path(
        "games/<int:pk>/ranks/add/",
        GameRankCreateView.as_view(),
        name="rank_add",
    ),
    path(
        "games/<int:pk>/ranks/<int:rank_id>/delete/",
        GameRankDeleteView.as_view(),
        name="rank_delete",
    ),
    path("listings/add/", ListingCreateView.as_view(), name="listing_add"),
    path("listings/<int:pk>/", ListingDetailView.as_view(), name="listing_detail"),
    path("listings/<int:pk>/edit/", ListingUpdateView.as_view(), name="listing_edit"),
    path(
        "listings/<int:pk>/delete/",
        ListingDeleteView.as_view(),
        name="listing_delete",
    ),
    path(
        "listings/<int:pk>/choices/add/",
        ListingChoiceCreateView.as_view(),
        name="choice_add",
    ),
    path(
        "listings/<int:pk>/choices/<int:choice_id>/delete/",
        ListingChoiceDeleteView.as_view(),
        name="choice_delete",
    ),
    path("chat/", ConversationListView.as_view(), name="chat_list"),
    path(
        "chat/<int:pk>/",
        ConversationDetailView.as_view(),
        name="conversation_detail",
    ),
]
