import { postForm } from './api';
import type { CreatedAccount, PublishListingInput } from '../types';

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
