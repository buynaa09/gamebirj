import { apiGet, apiPost } from './api';
import type { RegisterTeamInput, Tournament, TournamentRegistration } from '../types';

export function fetchTournaments(): Promise<Tournament[]> {
  return apiGet<Tournament[]>('/tournaments/');
}

export interface CheckedAccount {
  nickname: string;
  region: string;
}

export function checkLeaderId(
  tournamentId: number,
  userId: string,
  serverId: string,
): Promise<CheckedAccount> {
  return apiPost<CheckedAccount>('/tournaments/check-id/', {
    tournament_id: tournamentId,
    user_id: userId,
    server_id: serverId,
  });
}

export function registerTeam(
  tournamentId: number,
  input: RegisterTeamInput,
): Promise<TournamentRegistration> {
  return apiPost<TournamentRegistration>(`/tournaments/${tournamentId}/register/`, input);
}
