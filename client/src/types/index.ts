export type Theme = 'dark' | 'light';

export interface User {
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
