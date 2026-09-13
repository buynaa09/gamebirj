from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.mixins import UserPassesTestMixin
from django.db.models import Count
from django.db.models import Q
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.shortcuts import redirect
from django.urls import reverse
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import CreateView
from django.views.generic import DeleteView
from django.views.generic import DetailView
from django.views.generic import ListView
from django.views.generic import TemplateView
from django.views.generic import UpdateView

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.accounts.models import RentalTransaction
from backend.chat.models import Conversation
from backend.games.models import Game
from backend.games.models import GameRank
from backend.games.models import Listing
from backend.games.models import ListingChoice
from backend.panel.forms import GameForm
from backend.panel.forms import GameRankForm
from backend.panel.forms import ListingChoiceForm
from backend.panel.forms import ListingForm
from backend.users.models import User

PAGE_SIZE = 25


class StaffRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and user.is_staff


# Dashboard


class DashboardView(StaffRequiredMixin, TemplateView):
    template_name = "panel/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        account_stats = Account.objects.values("kind", "status").annotate(
            total=Count("id"),
        )
        counts = {("sale", "available"): 0}
        for row in account_stats:
            counts[(row["kind"], row["status"])] = row["total"]
        escrow_sums = EscrowTransaction.objects.values("status").annotate(
            total=Sum("amount"),
        )
        escrow_money = {row["status"]: row["total"] or 0 for row in escrow_sums}
        context.update(
            {
                "user_count": User.objects.count(),
                "staff_count": User.objects.filter(is_staff=True).count(),
                "sale_available": counts.get(("sale", Account.AVAILABLE), 0),
                "sale_sold": counts.get(("sale", Account.SOLD), 0),
                "rent_available": counts.get(("rent", Account.AVAILABLE), 0),
                "rent_rented": counts.get(("rent", Account.RENTED), 0),
                "escrow_held": escrow_money.get(EscrowTransaction.HELD, 0),
                "escrow_released": escrow_money.get(EscrowTransaction.RELEASED, 0),
                "active_rentals": RentalTransaction.objects.filter(
                    status=RentalTransaction.ACTIVE,
                ).count(),
                "recent_escrows": EscrowTransaction.objects.select_related(
                    "account",
                    "buyer",
                    "seller",
                ).order_by("-created_at")[:10],
                "recent_rentals": RentalTransaction.objects.select_related(
                    "account",
                    "renter",
                    "owner",
                ).order_by("-created_at")[:10],
                "recent_users": User.objects.order_by("-date_joined")[:10],
                "recent_accounts": Account.objects.select_related(
                    "game",
                    "user",
                ).order_by("-created_at")[:10],
            },
        )
        return context


# Users


class UserListView(StaffRequiredMixin, ListView):
    model = User
    template_name = "panel/users_list.html"
    context_object_name = "users"
    paginate_by = PAGE_SIZE
    ordering = ["-date_joined"]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.GET.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(name__icontains=query),
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["q"] = self.request.GET.get("q", "")
        return context


class UserDetailView(StaffRequiredMixin, DetailView):
    model = User
    template_name = "panel/user_detail.html"
    context_object_name = "profile_user"
    slug_field = "username"
    slug_url_kwarg = "username"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.object
        context.update(
            {
                "accounts": user.accounts.select_related("game").order_by(
                    "-created_at",
                )[:20],
                "purchases": user.purchases.select_related("game").order_by(
                    "-sold_at",
                )[:20],
                "rentals": user.rentals_as_renter.select_related("account").order_by(
                    "-created_at",
                )[:20],
            },
        )
        return context


class UserToggleActiveView(StaffRequiredMixin, View):
    def post(self, request, username):
        user = get_object_or_404(User, username=username)
        if user.pk == request.user.pk:
            messages.error(request, _("You cannot deactivate your own account."))
            return redirect("panel:user_detail", username=username)
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        state = _("activated") if user.is_active else _("deactivated")
        messages.success(
            request,
            _("User %(username)s %(state)s.")
            % {"username": user.username, "state": state},
        )
        return redirect("panel:user_detail", username=username)


class UserToggleStaffView(StaffRequiredMixin, View):
    def post(self, request, username):
        user = get_object_or_404(User, username=username)
        if user.pk == request.user.pk:
            messages.error(request, _("You cannot change your own staff status."))
            return redirect("panel:user_detail", username=username)
        user.is_staff = not user.is_staff
        user.save(update_fields=["is_staff"])
        state = _("granted") if user.is_staff else _("revoked")
        messages.success(
            request,
            _("Staff access %(state)s for %(username)s.")
            % {"state": state, "username": user.username},
        )
        return redirect("panel:user_detail", username=username)


# Listing management


class AccountListView(StaffRequiredMixin, ListView):
    model = Account
    template_name = "panel/accounts_list.html"
    context_object_name = "accounts"
    paginate_by = PAGE_SIZE
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("game", "user", "buyer")
        query = self.request.GET.get("q", "").strip()
        kind = self.request.GET.get("kind", "").strip()
        status = self.request.GET.get("status", "").strip()
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(user__username__icontains=query)
                | Q(game__name__icontains=query),
            )
        if kind in (Account.SALE, Account.RENT):
            queryset = queryset.filter(kind=kind)
        if status in (Account.AVAILABLE, Account.SOLD, Account.RENTED):
            queryset = queryset.filter(status=status)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "q": self.request.GET.get("q", ""),
                "kind": self.request.GET.get("kind", ""),
                "status": self.request.GET.get("status", ""),
            },
        )
        return context


class AccountDetailView(StaffRequiredMixin, DetailView):
    model = Account
    template_name = "panel/account_detail.html"
    context_object_name = "account"
    pk_url_kwarg = "pk"

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("game", "game_rank", "user", "buyer")
            .prefetch_related("images", "listings__listing", "listings__choices")
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        account = self.object
        context.update(
            {
                "escrow": getattr(account, "escrow", None),
                "rentals": account.rentals.select_related("renter", "owner").order_by(
                    "-created_at",
                ),
            },
        )
        return context


class AccountDeleteView(StaffRequiredMixin, DeleteView):
    model = Account
    template_name = "panel/account_confirm_delete.html"
    context_object_name = "account"
    success_url = reverse_lazy("panel:account_list")

    def form_valid(self, form):
        messages.success(self.request, _("Listing deleted."))
        return super().form_valid(form)


class AccountToggleOffersView(StaffRequiredMixin, View):
    def post(self, request, pk):
        account = get_object_or_404(Account, pk=pk)
        account.accept_offers = not account.accept_offers
        account.save(update_fields=["accept_offers"])
        state = _("enabled") if account.accept_offers else _("disabled")
        messages.success(request, _("Offers %(state)s.") % {"state": state})
        return redirect("panel:account_detail", pk=pk)


# Transactions


class TransactionListView(StaffRequiredMixin, TemplateView):
    template_name = "panel/transactions.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        escrow_status = self.request.GET.get("escrow_status", "").strip()
        rental_status = self.request.GET.get("rental_status", "").strip()
        escrows = EscrowTransaction.objects.select_related(
            "account",
            "buyer",
            "seller",
        ).order_by("-created_at")
        if escrow_status in (
            EscrowTransaction.HELD,
            EscrowTransaction.RELEASED,
            EscrowTransaction.REFUNDED,
        ):
            escrows = escrows.filter(status=escrow_status)
        rentals = RentalTransaction.objects.select_related(
            "account",
            "renter",
            "owner",
        ).order_by("-created_at")
        if rental_status in (
            RentalTransaction.ACTIVE,
            RentalTransaction.RETURNED,
            RentalTransaction.CANCELLED,
        ):
            rentals = rentals.filter(status=rental_status)
        context.update(
            {
                "escrows": escrows[:50],
                "rentals": rentals[:50],
                "escrow_status": escrow_status,
                "rental_status": rental_status,
            },
        )
        return context


# Games / ranks / listings


class GameListView(StaffRequiredMixin, ListView):
    model = Game
    template_name = "panel/games_list.html"
    context_object_name = "games"
    paginate_by = PAGE_SIZE
    ordering = ["name"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(
                rank_count=Count("ranks", distinct=True),
                listing_count=Count("listings", distinct=True),
            )
        )


class GameDetailView(StaffRequiredMixin, DetailView):
    model = Game
    template_name = "panel/game_detail.html"
    context_object_name = "game"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "rank_form": GameRankForm(),
                "ranks": self.object.ranks.order_by("order"),
                "listings": self.object.listings.prefetch_related("choices").order_by(
                    "id",
                ),
            },
        )
        return context


class GameCreateView(StaffRequiredMixin, CreateView):
    model = Game
    form_class = GameForm
    template_name = "panel/game_form.html"

    def get_success_url(self):
        return reverse("panel:game_detail", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        messages.success(self.request, _("Game created."))
        return super().form_valid(form)


class GameUpdateView(StaffRequiredMixin, UpdateView):
    model = Game
    form_class = GameForm
    template_name = "panel/game_form.html"

    def get_success_url(self):
        return reverse("panel:game_detail", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        messages.success(self.request, _("Game updated."))
        return super().form_valid(form)


class GameRankCreateView(StaffRequiredMixin, View):
    def post(self, request, pk):
        game = get_object_or_404(Game, pk=pk)
        form = GameRankForm(request.POST)
        if form.is_valid():
            rank = form.save(commit=False)
            rank.game = game
            rank.save()
            messages.success(request, _("Rank added."))
        else:
            messages.error(request, _("Could not add rank. Check the values."))
        return redirect("panel:game_detail", pk=game.pk)


class GameRankDeleteView(StaffRequiredMixin, View):
    def post(self, request, pk, rank_id):
        rank = get_object_or_404(GameRank, pk=rank_id, game_id=pk)
        rank.delete()
        messages.success(request, _("Rank deleted."))
        return redirect("panel:game_detail", pk=pk)


class ListingCreateView(StaffRequiredMixin, CreateView):
    model = Listing
    form_class = ListingForm
    template_name = "panel/listing_form.html"

    def get_initial(self):
        initial = super().get_initial()
        game_id = self.request.GET.get("game")
        if game_id:
            initial["game"] = game_id
        return initial

    def get_success_url(self):
        return reverse("panel:listing_detail", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        messages.success(self.request, _("Listing field created."))
        return super().form_valid(form)


class ListingDetailView(StaffRequiredMixin, DetailView):
    model = Listing
    template_name = "panel/listing_detail.html"
    context_object_name = "listing"

    def get_queryset(self):
        return super().get_queryset().select_related("game").prefetch_related("choices")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["choice_form"] = ListingChoiceForm()
        return context


class ListingUpdateView(StaffRequiredMixin, UpdateView):
    model = Listing
    form_class = ListingForm
    template_name = "panel/listing_form.html"

    def get_success_url(self):
        return reverse("panel:listing_detail", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        messages.success(self.request, _("Listing field updated."))
        return super().form_valid(form)


class ListingDeleteView(StaffRequiredMixin, DeleteView):
    model = Listing
    template_name = "panel/listing_confirm_delete.html"
    context_object_name = "listing"
    success_url = reverse_lazy("panel:game_list")

    def form_valid(self, form):
        messages.success(self.request, _("Listing field deleted."))
        return super().form_valid(form)


class ListingChoiceCreateView(StaffRequiredMixin, View):
    def post(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk)
        form = ListingChoiceForm(request.POST)
        if form.is_valid():
            choice = form.save(commit=False)
            choice.listing = listing
            choice.save()
            messages.success(request, _("Choice added."))
        else:
            messages.error(request, _("Could not add choice."))
        return redirect("panel:listing_detail", pk=listing.pk)


class ListingChoiceDeleteView(StaffRequiredMixin, View):
    def post(self, request, pk, choice_id):
        choice = get_object_or_404(ListingChoice, pk=choice_id, listing_id=pk)
        choice.delete()
        messages.success(request, _("Choice deleted."))
        return redirect("panel:listing_detail", pk=pk)


# Chat moderation (read-only)


class ConversationListView(StaffRequiredMixin, ListView):
    model = Conversation
    template_name = "panel/chat_list.html"
    context_object_name = "conversations"
    paginate_by = PAGE_SIZE
    ordering = ["-updated_at"]

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .select_related("user_low", "user_high", "account")
            .annotate(message_count=Count("messages"))
        )
        query = self.request.GET.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(user_low__username__icontains=query)
                | Q(user_high__username__icontains=query)
                | Q(account__title__icontains=query),
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["q"] = self.request.GET.get("q", "")
        return context


class ConversationDetailView(StaffRequiredMixin, DetailView):
    model = Conversation
    template_name = "panel/conversation_detail.html"
    context_object_name = "conversation"

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("user_low", "user_high", "account")
            .prefetch_related("offers__sender")
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        conversation = self.object
        context.update(
            {
                "messages": conversation.messages.select_related("sender").order_by(
                    "created_at",
                    "id",
                )[:200],
                "offers": conversation.offers.order_by("-created_at"),
            },
        )
        return context
