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
  created_at: string;
  wishlisted: boolean;
  wishlist_count: number;
  images: MarketImage[];
  listings: MarketAccountDetail[];
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
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem {
  conversation_id: number;
  other_user: ChatUserSummary;
  account_id: number | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender: ChatUserSummary;
  content: string;
  created_at: string;
  is_read: boolean;
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
      created_at: string;
      is_read: boolean;
    }
  | { type: 'message.read'; user_id: number; read: number }
  | { type: 'typing.started'; user_id: number }
  | { type: 'typing.stopped'; user_id: number }
  | { type: 'error'; detail: string };
