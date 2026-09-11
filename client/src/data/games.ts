import type { GameFilter } from '../types';

export const pillGames: GameFilter[] = [
  { id: 'all', name: 'All games', count: 12 },
  { id: 'Fortnite', name: 'Fortnite', icon: '🎮', count: 1 },
  { id: 'Clash of Clans', name: 'Clash of Clans', icon: '🏰', count: 1 },
  { id: 'Dunk City Dynasty', name: 'Dunk City Dynasty', icon: '🏀', count: 1 },
  { id: 'PUBG Mobile', name: 'PUBG Mobile', icon: '🎯', count: 2 },
  { id: 'Valorant', name: 'Valorant', icon: '🔫', count: 1 },
  { id: 'COD Mobile', name: 'COD Mobile', icon: '💀', count: 1 },
  { id: 'Brawl Stars', name: 'Brawl Stars', icon: '⭐', count: 1 },
  { id: 'LoL: Wild Rift', name: 'LoL: Wild Rift', icon: '🗡️', count: 1 },
];

export const sidebarGames: GameFilter[] = [
  { id: 'mobile-legends', name: 'Mobile Legends', count: 11 },
  { id: 'roblox', name: 'Roblox', count: 7 },
  { id: 'free-fire', name: 'Free Fire', count: 5 },
  { id: 'brawl-stars', name: 'Brawl Stars', count: 3 },
  { id: 'lol-wild-rift', name: 'League of Legends: Wild Rift', count: 3 },
  { id: 'clash-of-clans', name: 'Clash of Clans', count: 2 },
  { id: 'cod-mobile', name: 'COD Mobile', count: 2 },
  { id: 'pubg-mobile', name: 'PUBG Mobile', count: 2 },
];
