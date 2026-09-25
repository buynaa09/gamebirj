import { useEffect, useState } from 'react';
import { fetchTournamentMatches } from '../services/tournaments';
import type { TournamentMatch } from '../types';

// matchTools room states advance once a minute (cron poll) — refresh on the
// same rhythm so live matches show up without a manual page reload.
const REFRESH_MS = 30_000;

export function useTournamentMatches(tournamentId: number | null) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(tournamentId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (tournamentId === null) {
      return;
    }
    const timer = window.setInterval(() => setReloadKey((k) => k + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [tournamentId]);

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
