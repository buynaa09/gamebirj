export type Theme = 'dark' | 'light';

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  url: string;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

export interface SignupInput {
  username: string;
  email: string;
  password1: string;
  password2: string;
}

export interface PublishDetail {
  listing: number;
  value: string;
}

export interface PublishListingInput {
  gameId: number;
  rank: string;
  title: string;
  price: string;
  description: string;
  acceptOffers: boolean;
  details: PublishDetail[];
  images: File[];
  kind?: 'sale' | 'rent';
  rentalUnit?: 'hour' | 'day' | 'month';
}

export interface CreatedAccount {
  id: number;
  title: string;
  game: string | null;
  game_rank: string | null;
  price: number;
}
export interface GameListing {
  id: number;
  title: string;
  listing_type: string;
  place_holder_value: string | null;
  choices: string[];
}

export interface Game {
  id: number;
  name: string;
  image: string | null;
  ranks: string[];
  listings: GameListing[];
}

export interface MarketImage {
  id: number;
  image: string | null;
}

export interface MarketAccountDetail {
  listing_id: number;
  title: string;
  value: string;
  choices: string[];
}

export interface MarketAccount {
  id: number;
  title: string;
  game: string | null;
  game_rank: string | null;
  price: number;
  description: string;
  accept_offers: boolean;
  seller: string;
  status: string;
  kind: 'sale' | 'rent';
  rental_unit: 'hour' | 'day' | 'month' | null;
  sold_price: number | null;
  created_at: string;
  wishlisted: boolean;
  wishlist_count: number;
  images: MarketImage[];
  listings: MarketAccountDetail[];
}

export interface PurchaseOrder {
  order_id: number;
  account_id: number;
  amount: number;
  status: string;
  sold_at: string;
}

export type RentalUnit = 'hour' | 'day' | 'month';

export interface RentalOrder {
  order_id: number;
  account_id: number;
  unit: RentalUnit;
  duration: number;
  unit_price: number;
  total: number;
  status: string;
  start_at: string;
  end_at: string;
  is_renter: boolean;
  is_owner: boolean;
}

export interface EscrowOrder {
  order_id: number;
  account_id: number;
  amount: number;
  status: string;
  sold_at: string;
  is_buyer: boolean;
  is_seller: boolean;
}

export type SortKey = 'newest' | 'oldest' | 'price-asc' | 'price-desc';

export interface GameFilter {
  id: string;
  name: string;
  icon?: string;
  count: number;
}

export interface ChatUserSummary {
  id: number;
  username: string;
  name: string;
}

export interface Conversation {
  id: number;
  other_user: ChatUserSummary;
  account_id: number | null;
  agreed_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem {
  conversation_id: number;
  other_user: ChatUserSummary;
  account_id: number | null;
  agreed_price: number | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender: ChatUserSummary;
  content: string;
  image: string | null;
  created_at: string;
  is_read: boolean;
  offer: Offer | null;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface Offer {
  id: number;
  conversation_id: number;
  sender: ChatUserSummary;
  amount: number;
  status: OfferStatus;
  expires_at: string;
  decided_at: string | null;
  created_at: string;
}

export interface PaginatedMessages {
  items: ChatMessage[];
  page: number;
  page_size: number;
  total: number;
}

export type ChatServerEvent =
  | {
      type: 'message.created';
      id: number;
      conversation_id: number;
      sender: ChatUserSummary;
      content: string;
      image: string | null;
      created_at: string;
      is_read: boolean;
      offer: Offer | null;
    }
  | { type: 'message.read'; user_id: number; read: number }
  | { type: 'offer.updated'; offer: Offer; agreed_price: number | null }
  | { type: 'escrow.updated'; order: EscrowOrder }
  | { type: 'typing.started'; user_id: number }
  | { type: 'typing.stopped'; user_id: number }
  | { type: 'error'; detail: string };
