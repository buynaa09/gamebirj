export type Theme = 'dark' | 'light';

export interface Listing {
  id: string;
  game: string;
  title: string;
  rank: string;
  price: string;
  time: string;
  seller: string;
}

export interface GameFilter {
  id: string;
  name: string;
  icon?: string;
  count: number;
}
