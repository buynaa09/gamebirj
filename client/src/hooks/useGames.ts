import { useEffect, useState } from 'react';
import { fetchGames } from '../services/games';
import { sidebarGames } from '../data/games';
import { detailSectionFor, rankOptionsFor } from '../data/gameDetails';
import type { Game } from '../types';

// Static fallback so filters render even when the API is unreachable.
// Negative ids mark fallback entries (never sent back to the API).
function staticFallbackGames(): Game[] {
  return sidebarGames.map((g, index) => {
    const section = detailSectionFor(g.name);
    return {
      id: -(index + 1),
      name: g.name,
      image: null,
      ranks: rankOptionsFor(g.name),
      listings: section.fields.map((f, i) => ({
        id: -((index + 1) * 100 + i),
        title: f.label,
        listing_type: f.kind === 'select' ? 'choice' : 'text',
        place_holder_value: f.placeholder ?? null,
        choices: f.options ?? [],
      })),
    };
  });
}

let cache: Promise<Game[]> | null = null;

function getGames(): Promise<Game[]> {
  if (!cache) {
    cache = fetchGames().catch(() => staticFallbackGames());
  }
  return cache;
}

export function useGames(): Game[] {
  const [games, setGames] = useState<Game[]>(staticFallbackGames);

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
