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
