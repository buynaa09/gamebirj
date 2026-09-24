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
      {rounds.map((matches, r) => (
        <div className={styles.round} key={r} role="listitem" aria-label={roundLabel(matches.length)}>
          <div className={styles.roundTitle}>{roundLabel(matches.length)}</div>
          <div
            className={styles.matches}
            style={{ gap: `${gaps[r]}px`, paddingTop: `${pads[r]}px` }}
          >
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
        <div className={styles.matches} style={{ gap: '0px', paddingTop: `${championPad}px` }}>
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
