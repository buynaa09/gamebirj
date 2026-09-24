import { useMemo } from 'react';
import { useTournamentMatches } from '../../hooks/useTournamentMatches';
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

function ScoreRow({
  name,
  score,
  won,
}: {
  name: string | null;
  score: number | null;
  won: boolean;
}) {
  return (
    <div className={`${styles.team} ${name ? '' : styles.tbd} ${won ? styles.won : ''}`}>
      <span className={styles.avatar} aria-hidden="true">
        {name ? name.charAt(0).toUpperCase() : '?'}
      </span>
      <span className={styles.name}>{name ?? 'Тодорхойгүй'}</span>
      <span className={styles.score}>{score ?? '–'}</span>
      {won && (
        <span className={styles.crown} aria-label="Ялагч">
          🏆
        </span>
      )}
    </div>
  );
}

export function TournamentMatches({ tournamentId }: { tournamentId: number }) {
  const { matches, loading, error, reload } = useTournamentMatches(tournamentId);

  const history = useMemo(() => {
    const finished = matches.filter(isFinished);
    const map = new Map<number, TournamentMatch[]>();
    for (const m of finished) {
      const list = map.get(m.round_index) ?? [];
      list.push(m);
      map.set(m.round_index, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b - a)
      .map(([roundIndex, list]) => ({
        roundIndex,
        matches: list.sort((a, b) => a.position - b.position),
      }));
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
    <div className={styles.rounds}>
      {history.map(({ roundIndex, matches: list }) => {
        const matchesInRound = 2 ** (totalRounds - 1 - roundIndex);
        return (
          <section key={roundIndex} aria-label={roundLabel(matchesInRound)}>
            <h3 className={styles.roundTitle}>{roundLabel(matchesInRound)}</h3>
            <ul className={styles.list}>
              {list.map((m) => (
                <li key={m.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.matchNo}>Тоглолт {m.position + 1}</span>
                    <span className={`${styles.badge} ${styles.finished}`}>Дууссан</span>
                  </div>
                  <ScoreRow name={m.team_a} score={m.score_a} won={!!m.winner && m.winner === m.team_a} />
                  <ScoreRow name={m.team_b} score={m.score_b} won={!!m.winner && m.winner === m.team_b} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
