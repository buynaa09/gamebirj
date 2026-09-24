import { useEffect, useState } from 'react';
import { fetchTournamentMatches } from '../services/tournaments';
import type { TournamentMatch } from '../types';

export function useTournamentMatches(tournamentId: number | null) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(tournamentId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (tournamentId === null) {
      return;
    }
    let cancelled = false;
    fetchTournamentMatches(tournamentId)
      .then((result) => {
        if (!cancelled) {
          setMatches(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Тоглолтуудыг ачаалж чадсангүй.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, reloadKey]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  return { matches, loading, error, reload };
}
