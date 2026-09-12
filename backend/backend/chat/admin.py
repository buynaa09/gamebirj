from django.contrib import admin

from backend.chat.models import Conversation
from backend.chat.models import ConversationParticipant
from backend.chat.models import Message


class ConversationParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 0
    readonly_fields = ("user", "created_at")
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "participant_names", "account", "updated_at", "created_at")
    list_filter = ("account",)
    search_fields = (
        "user_low__username",
        "user_high__username",
        "pair_key",
    )
    readonly_fields = ("pair_key", "created_at", "updated_at")
    inlines = [ConversationParticipantInline]

    @admin.display(description="Participants")
    def participant_names(self, obj: Conversation) -> str:
        return f"{obj.user_low} ↔ {obj.user_high}"


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "user", "created_at")
    list_filter = ("conversation",)
    search_fields = ("user__username",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "conversation",
        "sender",
        "preview",
        "is_read",
        "created_at",
    )
    list_filter = ("is_read", "conversation")
    search_fields = ("content", "sender__username")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Preview")
    def preview(self, obj: Message) -> str:
        return obj.content[:60]
