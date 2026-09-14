import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WishlistContext } from './WishlistContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { addWishlist, fetchWishlist, removeWishlist } from '../services/accounts';

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchWishlist()
      .then((result) => {
        if (!cancelled) setIds(new Set(result.map((a) => a.id)));
      })
      .catch(() => {
        // Stay empty — hearts simply render unfilled.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    (id: number) => {
      if (!user) {
        navigate('/login');
        return;
      }
      const active = ids.has(id);
      const next = new Set(ids);
      if (active) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setIds(next);
      (active ? removeWishlist(id) : addWishlist(id)).catch(() => {
        setIds(ids);
      });
    },
    [ids, user, navigate],
  );

  return <WishlistContext.Provider value={{ ids, toggle }}>{children}</WishlistContext.Provider>;
}
