import { apiGet } from './api';
import type { Game } from '../types';

export function fetchGames(): Promise<Game[]> {
  return apiGet<Game[]>('/games/');
}
