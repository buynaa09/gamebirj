import type { TournamentStatus } from '../types';

export function tournamentStarted(status: TournamentStatus, startsAt: string | null): boolean {
  if (status === 'live') return true;
  if (status !== 'open' || !startsAt) return false;
  const time = new Date(startsAt).getTime();
  return !Number.isNaN(time) && time <= Date.now();
}

export function effectiveTournamentStatus(
  status: TournamentStatus,
  startsAt: string | null,
): TournamentStatus {
  return status === 'open' && tournamentStarted(status, startsAt) ? 'live' : status;
}

const rulesKey = (id: number) => `gb:tournament-rules:${id}`;

/** Whether the user already checked "agree" on this tournament's rules. */
export function hasAcceptedRules(id: number): boolean {
  try {
    return localStorage.getItem(rulesKey(id)) === '1';
  } catch {
    return false;
  }
}

/** Persist rules acceptance for a tournament. */
export function saveAcceptedRules(id: number): void {
  try {
    localStorage.setItem(rulesKey(id), '1');
  } catch {
    // Private mode etc. — acceptance just won't persist.
  }
}
