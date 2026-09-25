import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTournament } from '../services/tournaments';
import type { TournamentDetail } from '../types';

export function useTournament(id: number) {
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  // Never touches state synchronously, so the mount effect below stays clear
  // of react-hooks/set-state-in-effect; `reload` is the one that flags loading.
  const load = useCallback((): Promise<TournamentDetail | null> => {
    const seq = ++requestSeq.current;
    return fetchTournament(id).then(
      (result) => {
        if (seq !== requestSeq.current) return null;
        setTournament(result);
        setError(null);
        setLoading(false);
        return result;
      },
      (err: unknown) => {
        if (seq === requestSeq.current) {
          setError(err instanceof Error ? err.message : 'Failed to load tournament.');
          setLoading(false);
        }
        return null;
      },
    );
  }, [id]);

  const reload = useCallback((): Promise<TournamentDetail | null> => {
    setLoading(true);
    setError(null);
    return load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { tournament, loading, error, reload };
}
