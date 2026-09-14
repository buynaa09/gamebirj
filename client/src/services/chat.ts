import { API_BASE, apiGet, apiPost, postForm } from './api';
import type {
  ChatMessage,
  Conversation,
  ConversationListItem,
  Offer,
  PaginatedMessages,
} from '../types';

export const CHAT_PAGE_SIZE = 30;

export function fetchConversations(): Promise<ConversationListItem[]> {
  return apiGet<ConversationListItem[]>('/chat/conversations/');
}

export function fetchConversation(id: number): Promise<Conversation> {
  return apiGet<Conversation>(`/chat/conversations/${id}/`);
}

export function createConversation(
  other: { userId?: number; username?: string },
  accountId?: number,
): Promise<Conversation> {
  return apiPost<Conversation>('/chat/conversations/', {
    user_id: other.userId ?? null,
    username: other.username ?? null,
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

/** Text fallback via multipart (the endpoint accepts form data). */
export function sendMessageRest(conversationId: number, content: string): Promise<ChatMessage> {
  const form = new FormData();
  form.set('content', content);
  return postForm<ChatMessage>(`/chat/conversations/${conversationId}/messages/`, form);
}

/** Text and/or image via multipart (WebSocket transport is text-only). */
export function sendMessageWithImage(
  conversationId: number,
  content: string,
  image: File,
): Promise<ChatMessage> {
  const form = new FormData();
  form.set('content', content);
  form.append('image', image);
  return postForm<ChatMessage>(`/chat/conversations/${conversationId}/messages/`, form);
}

export function markConversationRead(conversationId: number): Promise<{ read: number }> {
  return apiPost<{ read: number }>(`/chat/conversations/${conversationId}/read/`, {});
}

export function createOffer(conversationId: number, amount: number): Promise<ChatMessage> {
  return apiPost<ChatMessage>(`/chat/conversations/${conversationId}/offers/`, { amount });
}

export function acceptOffer(offerId: number): Promise<Offer> {
  return apiPost<Offer>(`/chat/offers/${offerId}/accept/`, {});
}

export function declineOffer(offerId: number): Promise<Offer> {
  return apiPost<Offer>(`/chat/offers/${offerId}/decline/`, {});
}

export function cancelOffer(offerId: number): Promise<Offer> {
  return apiPost<Offer>(`/chat/offers/${offerId}/cancel/`, {});
}

/** Start (or reuse) a 1-to-1 thread about a listing; returns the conversation id. */
export async function openSellerThread(sellerUsername: string, accountId: number): Promise<number> {
  const conversation = await createConversation({ username: sellerUsername }, accountId);
  return conversation.id;
}

/** ws(s)://host/ws/chat/{id}/ derived from the REST base URL.
 *  Browsers can't set WebSocket headers, so the Clerk JWT travels as
 *  `?token=` and is verified by the Django channel middleware. */
export function buildChatWsUrl(conversationId: number, token?: string | null): string {
  const base = API_BASE.replace(/\/api\/?$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  const url = `${wsBase}/ws/chat/${conversationId}/`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
