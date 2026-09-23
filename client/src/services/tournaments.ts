import { apiGet, apiPost } from './api';
import type { RegisterTeamInput, Tournament, TournamentRegistration } from '../types';

export function fetchTournaments(): Promise<Tournament[]> {
  return apiGet<Tournament[]>('/tournaments/');
}

export function registerTeam(
  tournamentId: number,
  input: RegisterTeamInput,
): Promise<TournamentRegistration> {
  return apiPost<TournamentRegistration>(`/tournaments/${tournamentId}/register/`, input);
}
