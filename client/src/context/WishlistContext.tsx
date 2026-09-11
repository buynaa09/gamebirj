import { createContext, useContext } from 'react';

export interface WishlistContextValue {
  ids: Set<number>;
  toggle: (id: number) => void;
}

export const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
