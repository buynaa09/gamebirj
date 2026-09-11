import type { GameFilter } from '../types';

// Offline fallback names for the games hook (used only when /api/games/
// is unreachable). Counts always come from real listings.
export const sidebarGames: GameFilter[] = [
  { id: 'mobile-legends', name: 'Mobile Legends', count: 0 },
  { id: 'roblox', name: 'Roblox', count: 0 },
  { id: 'free-fire', name: 'Free Fire', count: 0 },
  { id: 'brawl-stars', name: 'Brawl Stars', count: 0 },
  { id: 'lol-wild-rift', name: 'League of Legends: Wild Rift', count: 0 },
  { id: 'clash-of-clans', name: 'Clash of Clans', count: 0 },
  { id: 'cod-mobile', name: 'COD Mobile', count: 0 },
  { id: 'pubg-mobile', name: 'PUBG Mobile', count: 0 },
];

// Pill icons keyed by game name.
export const gameIcons: Record<string, string | undefined> = {
  Fortnite: '🎮',
  'Clash of Clans': '🏰',
  'Dunk City Dynasty': '🏀',
  'PUBG Mobile': '🎯',
  Valorant: '🔫',
  'COD Mobile': '💀',
  'Brawl Stars': '⭐',
  'LoL: Wild Rift': '🗡️',
  'League of Legends: Wild Rift': '🗡️',
  'Mobile Legends': '🎮',
  Roblox: '🧱',
  'Free Fire': '🔥',
};
