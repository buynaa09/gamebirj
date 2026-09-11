import { useEffect, useState } from 'react';
import { fetchGames } from '../services/games';
import { sidebarGames } from '../data/games';
import type { Game } from '../types';

// Static fallback so filters render even when the API is unreachable.
// Negative ids mark fallback entries (never sent back to the API).
const staticFallback: Game[] = sidebarGames.map((g, index) => ({
  id: -(index + 1),
  name: g.name,
  image: null,
}));

let cache: Promise<Game[]> | null = null;

function getGames(): Promise<Game[]> {
  if (!cache) {
    cache = fetchGames().catch(() => staticFallback);
  }
  return cache;
}

export function useGames(): Game[] {
  const [games, setGames] = useState<Game[]>(staticFallback);

  useEffect(() => {
    let cancelled = false;
    getGames().then((result) => {
      if (!cancelled) setGames(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return games;
}
