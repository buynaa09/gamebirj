import { useEffect, useState } from 'react';
import { fetchAccount } from '../services/accounts';
import type { MarketAccount } from '../types';

export function useAccount(id: number) {
  const [account, setAccount] = useState<MarketAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccount(id)
      .then((result) => {
        if (!cancelled) setAccount(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load listing.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { account, loading, error };
}
