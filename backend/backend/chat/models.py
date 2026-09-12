from django.conf import settings
from django.db import models
from django.db.models import F
from django.db.models import Q


def ordered_pair(user_id_a: int, user_id_b: int) -> tuple[int, int]:
    """Return (low, high) so A+B and B+A always resolve identically."""
    if user_id_a < user_id_b:
        return (user_id_a, user_id_b)
    return (user_id_b, user_id_a)


def pair_key_for(user_id_a: int, user_id_b: int) -> str:
    low, high = ordered_pair(user_id_a, user_id_b)
    return f"{low}:{high}"


class Conversation(models.Model):
    """A strictly 1-to-1 private conversation between exactly two users.

    ``account`` is optional: ``None`` means a generic DM, otherwise the
    thread is scoped to a marketplace listing while still containing only
    the same two participants.
    """

    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    user_low = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_low",
    )
    user_high = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_high",
    )
    pair_key = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            # Enforces ordering (low < high), which also forbids self-chat.
            models.CheckConstraint(
                condition=Q(user_low__lt=F("user_high")),
                name="chat_conversation_ordered_pair",
            ),
            # A+B == B+A: one generic thread per pair, one thread per
            # (pair, listing). NULL account values compare as equal.
            models.UniqueConstraint(
                fields=["pair_key", "account"],
                name="unique_private_conversation",
                nulls_distinct=False,
            ),
        ]
        indexes = [
            models.Index(fields=["account"], name="chat_conv_account_idx"),
        ]

    def __str__(self) -> str:
        return f"Conversation {self.pk} ({self.pair_key})"

    def get_other_user_id(self, user_id: int) -> int:
        if user_id == self.user_low_id:
            return self.user_high_id
        return self.user_low_id


class ConversationParticipant(models.Model):
    """Explicit join table — exactly 2 rows per conversation (no M2M)."""

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_participations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"],
                name="unique_conversation_participant",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "conversation"],
                name="chat_part_user_conv_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in conversation {self.conversation_id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(
                fields=["conversation", "-created_at", "-id"],
                name="chat_msg_conv_created_idx",
            ),
            models.Index(fields=["sender"], name="chat_msg_sender_idx"),
            models.Index(
                fields=["conversation", "is_read"],
                name="chat_msg_unread_idx",
                condition=Q(is_read=False),
            ),
        ]

    def __str__(self) -> str:
        return f"Message {self.pk} from {self.sender_id}"
