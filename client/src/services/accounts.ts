import { apiDelete, apiGet, apiPatch, apiPost, postForm } from './api';
import type { CreatedAccount, MarketAccount, PublishListingInput } from '../types';

export function fetchAccounts(params?: { game?: number; q?: string }): Promise<MarketAccount[]> {
  const search = new URLSearchParams();
  if (params?.game !== undefined) search.set('game', String(params.game));
  if (params?.q) search.set('q', params.q);
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return apiGet<MarketAccount[]>(`/accounts/${suffix}`);
}

export function fetchAccount(id: number): Promise<MarketAccount> {
  return apiGet<MarketAccount>(`/accounts/${id}/`);
}

export function fetchWishlist(): Promise<MarketAccount[]> {
  return apiGet<MarketAccount[]>('/accounts/wishlist/');
}

export function fetchMyAccounts(): Promise<MarketAccount[]> {
  return apiGet<MarketAccount[]>('/accounts/mine/');
}

export interface AccountPatch {
  title?: string;
  price?: string;
  description?: string;
  accept_offers?: boolean;
}

export function updateAccount(id: number, patch: AccountPatch): Promise<MarketAccount> {
  return apiPatch<MarketAccount>(`/accounts/${id}/`, patch);
}

export function deleteAccount(id: number): Promise<void> {
  return apiDelete<void>(`/accounts/${id}/`);
}

export function addWishlist(id: number): Promise<void> {
  return apiPost<void>(`/accounts/${id}/wishlist/`, {});
}

export function removeWishlist(id: number): Promise<void> {
  return apiDelete<void>(`/accounts/${id}/wishlist/`);
}

export function publishListing(input: PublishListingInput): Promise<CreatedAccount> {
  const form = new FormData();
  form.set('game', String(input.gameId));
  form.set('game_rank', input.rank);
  form.set('title', input.title);
  form.set('price', input.price);
  form.set('description', input.description);
  form.set('accept_offers', input.acceptOffers ? 'true' : 'false');
  form.set('details', JSON.stringify(input.details));
  for (const image of input.images) {
    form.append('images', image);
  }
  return postForm<CreatedAccount>('/accounts/', form);
}
