from datetime import datetime  # noqa: TC003 — Ninja resolves hints at runtime

from ninja import Field
from ninja import Schema


class UserSummary(Schema):
    """Public subset of user fields — never exposes email/password."""

    id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    name: str = Field("", description="Display name")


class LastMessageSchema(Schema):
    content: str = Field(..., description="Last message text")
    created_at: datetime | None = Field(None, description="When it was sent")
    sender_id: int | None = Field(None, description="Sender user ID")


class ConversationSchema(Schema):
    id: int = Field(..., description="Conversation ID")
    other_user: UserSummary = Field(..., description="The other participant")
    account_id: int | None = Field(
        None,
        description="Linked listing ID, null for generic DMs",
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last activity timestamp")


class ConversationListItem(Schema):
    conversation_id: int = Field(..., description="Conversation ID")
    other_user: UserSummary = Field(..., description="The other participant")
    account_id: int | None = Field(
        None,
        description="Linked listing ID, null for generic DMs",
    )
    last_message: str | None = Field(None, description="Last message preview")
    last_message_at: datetime | None = Field(
        None,
        description="Last message timestamp",
    )
    unread_count: int = Field(0, description="Unread messages from the other user")


class MessageSchema(Schema):
    id: int = Field(..., description="Message ID")
    conversation_id: int = Field(..., description="Conversation ID")
    sender: UserSummary = Field(..., description="Sender summary")
    content: str = Field(..., description="Message text")
    created_at: datetime = Field(..., description="Sent timestamp")
    is_read: bool = Field(default=False, description="Read state")


class PaginatedMessages(Schema):
    items: list[MessageSchema] = Field(..., description="Messages, oldest first")
    page: int = Field(..., description="Current page (1-based)")
    page_size: int = Field(..., description="Page size")
    total: int = Field(..., description="Total message count")


class CreateConversationRequest(Schema):
    user_id: int | None = Field(
        None,
        description="The other participant's user ID (either this or username)",
    )
    username: str | None = Field(
        None,
        description="The other participant's username (either this or user_id)",
    )
    account_id: int | None = Field(
        None,
        description="Optional listing ID to scope the thread",
    )


class SendMessageRequest(Schema):
    content: str = Field(..., description="Message text (1-2000 characters)")


class MarkReadResponse(Schema):
    read: int = Field(..., description="Number of messages marked as read")
