import type { TournamentStatus } from '../types';

/** True once a tournament has begun: status flipped to live, or an open
 *  tournament whose scheduled start time has passed. */
export function tournamentStarted(status: TournamentStatus, startsAt: string | null): boolean {
  if (status === 'live') return true;
  if (status !== 'open' || !startsAt) return false;
  const time = new Date(startsAt).getTime();
  return !Number.isNaN(time) && time <= Date.now();
}
