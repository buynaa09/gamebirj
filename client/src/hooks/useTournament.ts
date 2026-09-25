import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTournament } from '../services/tournaments';
import type { TournamentDetail } from '../types';

export function useTournament(id: number) {
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  /** Fetch the tournament and resolve with it (or null on failure/supersede). */
  const load = useCallback(async (): Promise<TournamentDetail | null> => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTournament(id);
      if (seq !== requestSeq.current) return null;
      setTournament(result);
      return result;
    } catch (err: unknown) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err.message : 'Failed to load tournament.');
      }
      return null;
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { tournament, loading, error, reload: load };
}
