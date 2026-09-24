import { useMemo } from 'react';
import type { TournamentMatch } from '../../types';
import styles from './TournamentMatches.module.css';

function roundLabel(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Финал';
  if (matchesInRound === 2) return 'Хагас шигшээ';
  return `Шөвгийн ${matchesInRound * 2}`;
}

function isFinished(match: TournamentMatch): boolean {
  return match.status === 'finished' || !!match.winner;
}

export function TournamentMatches({
  matches,
  loading,
  error,
  reload,
}: {
  matches: TournamentMatch[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {

  const history = useMemo(() => {
    const finished = matches.filter(isFinished);
    return finished.sort((a, b) => b.round_index - a.round_index || a.position - b.position);
  }, [matches]);
  const totalRounds = useMemo(() => {
    const max = matches.reduce((acc, m) => Math.max(acc, m.round_index), 0);
    return max + 1;
  }, [matches]);

  if (loading && matches.length === 0) {
    return <p className={styles.state}>Тоглолтууд ачааллаж байна…</p>;
  }
  if (error && matches.length === 0) {
    return (
      <p className={styles.state}>
        {error}{' '}
        <button type="button" className={styles.retry} onClick={reload}>
          Дахин оролдох
        </button>
      </p>
    );
  }
  if (history.length === 0) {
    return <p className={styles.state}>Дууссан тоглолт байхгүй байна.</p>;
  }

  return (
    <ul className={styles.list}>
      {history.map((m) => {
        const matchesInRound = 2 ** (totalRounds - 1 - m.round_index);
        const decided = !!m.winner;
        const wonA = decided && m.winner === m.team_a;
        const wonB = decided && m.winner === m.team_b;
        return (
          <li key={m.id} className={styles.row}>
            <span className={styles.meta}>
              {roundLabel(matchesInRound)} · Тоглолт {m.position + 1}
            </span>
            <span className={styles.result}>
              
              <span className={`${styles.teamName} ${wonA ? styles.won : ''}`}>
                
                <span className={styles.truncate}>{m.team_a ?? 'Тодорхойгүй'}</span>
                 <span className={`${styles.avatar} ${styles.avatarA}`} aria-hidden="true">
                  {(m.team_a ?? '?').charAt(0).toUpperCase()}
                </span>
                {decided && (
                  <span className={wonA ? styles.win : styles.loss}>
                    {wonA ? 'WIN' : 'LOSS'}
                  </span>
                )}
               
              </span>
              <span className={styles.score}>
                {m.score_a ?? '–'} : {m.score_b ?? '–'}
              </span>
              <span className={`${styles.teamName} ${styles.right} ${wonB ? styles.won : ''}`}>
    
                {decided && (
                  <span className={wonB ? styles.win : styles.loss}>
                    {wonB ? 'WIN' : 'LOSS'}
                  </span>
                )}
                            <span className={`${styles.avatar} ${styles.avatarB}`} aria-hidden="true">
                  {(m.team_b ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className={styles.truncate}>{m.team_b ?? 'Тодорхойгүй'}</span>
              </span>
            </span>
            <span className={`${styles.badge} ${styles.finished}`}>Дууссан</span>
          </li>
        );
      })}
    </ul>
  );
}
