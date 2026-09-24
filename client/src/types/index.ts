export type Theme = 'dark' | 'light';

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  url: string;
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

export interface QPayBank {
  name: string;
  description: string;
  logo: string;
  link: string;
}

export type QPayPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface QPayPayment {
  id: number;
  sender_invoice_no: string;
  account_id: number;
  kind: 'sale' | 'rent';
  duration: number;
  amount: number;
  status: QPayPaymentStatus;
  invoice_id: string;
  qpay_short_url: string;
  qpay_qr_text: string;
  qpay_qr_image: string;
  banks: QPayBank[];
  paid_amount: number | null;
  created_at: string;
  paid_at: string | null;
}

export type SortKey = 'newest' | 'oldest' | 'price-asc' | 'price-desc';

export type TournamentStatus = 'open' | 'live' | 'finished';

export interface Tournament {
  id: number;
  title: string;
  game_id: number;
  game: string;
  id_check_slug: string;
  status: TournamentStatus;
  prize_pool: string;
  entry_fee: string;
  starts_at: string | null;
  ends_at: string | null;
  format: string;
  mode: string;
  team_size: number;
  rules: string;
  total_slots: number;
  filled_slots: number;
  slot_unit: string;
  is_registered: boolean;
}

export interface RegisterTeamInput {
  team_id: number;
}

export interface CreateTeamInput {
  game_id: number;
  name: string;
  leader_game_id: string;
  leader_server_id?: string;
  leader_nickname?: string;
}

export interface TournamentTeam {
  id: number;
  game_id: number;
  game: string;
  name: string;
  leader_game_id: string;
  leader_server_id: string;
  leader_nickname: string;
  created_at: string;
}

export interface TournamentRegistration {
  id: number;
  tournament: number;
  team_name: string;
  leader_game_id: string;
  created_at: string;
}

export interface RegisteredTeam {
  team_name: string;
  leader_nickname: string;
  created_at: string;
}

export interface TournamentDetail extends Tournament {
  registrations: RegisteredTeam[];
}

export interface TournamentMatch {
  id: number;
  round_index: number;
  position: number;
  team_a: string | null;
  team_b: string | null;
  winner: string | null;
  status: string;
  has_room: boolean;
  draft_url: string | null;
}

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
