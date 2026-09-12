import { API_BASE, apiGet, apiPost } from './api';
import type {
  ChatMessage,
  Conversation,
  ConversationListItem,
  PaginatedMessages,
  User,
} from '../types';

export const CHAT_PAGE_SIZE = 30;

export function fetchConversations(): Promise<ConversationListItem[]> {
  return apiGet<ConversationListItem[]>('/chat/conversations/');
}

export function fetchConversation(id: number): Promise<Conversation> {
  return apiGet<Conversation>(`/chat/conversations/${id}/`);
}

export function createConversation(userId: number, accountId?: number): Promise<Conversation> {
  return apiPost<Conversation>('/chat/conversations/', {
    user_id: userId,
    account_id: accountId ?? null,
  });
}

export function fetchMessages(
  conversationId: number,
  page = 1,
  pageSize: number = CHAT_PAGE_SIZE,
): Promise<PaginatedMessages> {
  return apiGet<PaginatedMessages>(
    `/chat/conversations/${conversationId}/messages/?page=${page}&page_size=${pageSize}`,
  );
}

/** Newest page of history (backend returns oldest-first per page). */
export async function fetchLatestMessages(conversationId: number): Promise<PaginatedMessages> {
  const first = await fetchMessages(conversationId, 1);
  if (first.total <= first.items.length) return first;
  const lastPage = Math.max(1, Math.ceil(first.total / first.page_size));
  return fetchMessages(conversationId, lastPage, first.page_size);
}

export function sendMessageRest(conversationId: number, content: string): Promise<ChatMessage> {
  return apiPost<ChatMessage>(`/chat/conversations/${conversationId}/messages/`, { content });
}

export function markConversationRead(conversationId: number): Promise<{ read: number }> {
  return apiPost<{ read: number }>(`/chat/conversations/${conversationId}/read/`, {});
}

export function fetchUserByUsername(username: string): Promise<User> {
  return apiGet<User>(`/users/${encodeURIComponent(username)}/`);
}

/** Start (or reuse) a 1-to-1 thread about a listing; returns the conversation id. */
export async function openSellerThread(sellerUsername: string, accountId: number): Promise<number> {
  const seller = await fetchUserByUsername(sellerUsername);
  const conversation = await createConversation(seller.id, accountId);
  return conversation.id;
}

/** ws(s)://host/ws/chat/{id}/ derived from the REST base URL (cookies included). */
export function buildChatWsUrl(conversationId: number): string {
  const base = API_BASE.replace(/\/api\/?$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/chat/${conversationId}/`;
}
