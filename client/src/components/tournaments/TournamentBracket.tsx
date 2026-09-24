import { TrophyIcon } from '../icons/Icons';
import type { RegisteredTeam, TournamentMatch } from '../../types';
import styles from './TournamentBracket.module.css';

interface TournamentBracketProps {
  matches: TournamentMatch[];
  teams: RegisteredTeam[];
  totalSlots: number;
}

interface Slot {
  name: string | null;
  won: boolean;
}

const MATCH_H = 60;
const BASE_GAP = 12;

function bracketSize(totalSlots: number): number {
  let size = 2;
  const target = Math.max(2, totalSlots);
  while (size < target) size *= 2;
  return size;
}

function roundLabel(matches: number): string {
  if (matches === 1) return 'Финал';
  if (matches === 2) return 'Хагас шигшээ';
  return `Шөвгийн ${matches * 2}`;
}

function SlotRow({ slot }: { slot: Slot }) {
  return (
    <div className={`${styles.slot} ${slot.name ? '' : styles.tbd} ${slot.won ? styles.won : ''}`}>
      <span className={styles.avatar} aria-hidden="true">
        {slot.name ? slot.name.charAt(0).toUpperCase() : '?'}
      </span>
      <span className={styles.name}>{slot.name ?? 'Тодорхойгүй'}</span>
    </div>
  );
}

export function TournamentBracket({ matches, teams, totalSlots }: TournamentBracketProps) {
  const size = bracketSize(totalSlots);
  const numRounds = Math.max(1, Math.log2(size));

  const byRound = new Map<number, Map<number, TournamentMatch>>();
  for (const m of matches) {
    let round = byRound.get(m.round_index);
    if (!round) {
      round = new Map();
      byRound.set(m.round_index, round);
    }
    round.set(m.position, m);
  }

  // Slots come from real match data (advanced winners included); round 0
  // falls back to registrations while matches are still loading.
  const rounds: Slot[][][] = [];
  for (let r = 0; r < numRounds; r++) {
    const count = size >> (r + 1);
    const roundMatches: Slot[][] = [];
    for (let i = 0; i < count; i++) {
      const m = byRound.get(r)?.get(i);
      const nameA = m?.team_a ?? (r === 0 ? (teams[2 * i]?.team_name ?? null) : null);
      const nameB = m?.team_b ?? (r === 0 ? (teams[2 * i + 1]?.team_name ?? null) : null);
      roundMatches.push([
        { name: nameA, won: !!m?.winner && m.winner === m.team_a },
        { name: nameB, won: !!m?.winner && m.winner === m.team_b },
      ]);
    }
    rounds.push(roundMatches);
  }

  const final = byRound.get(numRounds - 1)?.get(0);
  const champion = final?.winner ?? null;

  // Each match must sit exactly centered between its two feeders. With
  // top-aligned columns that means round r starts half a feeder-unit lower
  // and doubles its spacing every round: pad_r = U*(2^r-1)/2, gap_r = U*2^r-H.
  const unit = MATCH_H + BASE_GAP;
  const pads = rounds.map((_, r) => (unit * (2 ** r - 1)) / 2);
  const gaps = rounds.map((_, r) => unit * 2 ** r - MATCH_H);
  // Vertical connector span for round r = distance between its feeders' centers.
  const spans = rounds.map((_, r) => (r === 0 ? 0 : unit * 2 ** (r - 1)));
  const championPad = pads[pads.length - 1] ?? 0;

  return (
    <div className={styles.bracket} role="list" aria-label="Single elimination шат">
      {rounds.map((roundMatches, r) => (
        <div className={styles.round} key={r} role="listitem" aria-label={roundLabel(roundMatches.length)}>
          <div className={styles.roundTitle}>{roundLabel(roundMatches.length)}</div>
          <div
            className={styles.matches}
            style={{ gap: `${gaps[r]}px`, paddingTop: `${pads[r]}px` }}
          >
            {roundMatches.map(([a, b], i) => (
              <div
                key={i}
                className={`${styles.match} ${r > 0 ? styles.hasIncoming : ''}`}
              >
                {r > 0 && (
                  <span
                    className={styles.vline}
                    style={{ height: `${spans[r]}px` }}
                    aria-hidden="true"
                  />
                )}
                <SlotRow slot={a} />
                <SlotRow slot={b} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.round} role="listitem" aria-label="Аварга">
        <div className={styles.roundTitle}>Аварга</div>
        <div className={styles.matches} style={{ gap: '0px', paddingTop: `${championPad}px` }}>
          <div className={`${styles.match} ${styles.champion} ${styles.hasIncoming}`}>
            <div className={`${styles.slot} ${champion ? '' : styles.tbd} ${champion ? styles.won : ''}`}>
              <span className={styles.trophy} aria-hidden="true">
                <TrophyIcon size={18} />
              </span>
              <span className={`${styles.name} ${champion ? '' : styles.tbdName}`}>
                {champion ?? 'Тодорхойгүй'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
