import { TrophyIcon } from '../icons/Icons';
import type { RegisteredTeam } from '../../types';
import styles from './TournamentBracket.module.css';

interface TournamentBracketProps {
  teams: RegisteredTeam[];
  totalSlots: number;
}

interface Slot {
  name: string | null;
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
    <div className={`${styles.slot} ${slot.name ? '' : styles.tbd}`}>
      <span className={styles.avatar} aria-hidden="true">
        {slot.name ? slot.name.charAt(0).toUpperCase() : '?'}
      </span>
      <span className={styles.name}>{slot.name ?? 'Тодорхойгүй'}</span>
    </div>
  );
}

export function TournamentBracket({ teams, totalSlots }: TournamentBracketProps) {
  const size = bracketSize(totalSlots);

  // Round 0 slots come from registrations (in order), the rest are TBD.
  const firstRound: Slot[] = Array.from({ length: size }, (_, i) => ({
    name: teams[i]?.team_name ?? null,
  }));

  const rounds: Slot[][][] = [];
  let slots: Slot[] = firstRound;
  while (slots.length >= 2) {
    const matches: Slot[][] = [];
    for (let i = 0; i < slots.length; i += 2) {
      matches.push([slots[i], slots[i + 1]]);
    }
    rounds.push(matches);
    // Winners unknown (no score data yet) — later rounds are all TBD.
    slots = Array.from({ length: matches.length }, () => ({ name: null }));
  }

  // Column height is driven by round 0 (size/2 matches); later rounds spread
  // evenly so each match stays vertically centered between its two feeders.
  const firstRoundMatches = size / 2;
  const fullHeight = firstRoundMatches * MATCH_H + (firstRoundMatches - 1) * BASE_GAP;
  const gaps = rounds.map((matches) => {
    if (matches.length <= 1) return 0;
    return (fullHeight - matches.length * MATCH_H) / (matches.length - 1);
  });
  // Vertical connector span for round r = distance between its feeders' centers.
  const spans = gaps.map((_, r) => (r === 0 ? 0 : MATCH_H + gaps[r - 1]));

  return (
    <div className={styles.bracket} role="list" aria-label="Single elimination шат">
      {rounds.map((matches, r) => (
        <div className={styles.round} key={r} role="listitem" aria-label={roundLabel(matches.length)}>
          <div className={styles.roundTitle}>{roundLabel(matches.length)}</div>
          <div className={styles.matches} style={{ gap: `${gaps[r]}px` }}>
            {matches.map(([a, b], i) => (
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
        <div className={styles.matches} style={{ gap: '0px' }}>
          <div className={`${styles.match} ${styles.champion} ${styles.hasIncoming}`}>
            <div className={styles.slot}>
              <span className={styles.trophy} aria-hidden="true">
                <TrophyIcon size={18} />
              </span>
              <span className={`${styles.name} ${styles.tbdName}`}>Тодорхойгүй</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
