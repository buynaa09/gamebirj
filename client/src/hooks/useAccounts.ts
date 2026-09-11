import { useEffect, useState } from 'react';
import { fetchAccounts } from '../services/accounts';
import type { MarketAccount } from '../types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<MarketAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAccounts()
      .then((result) => {
        if (!cancelled) setAccounts(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load listings.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  return { accounts, loading, error, reload };
}
