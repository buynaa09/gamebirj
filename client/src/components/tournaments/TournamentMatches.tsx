import { useMemo } from 'react';
import { useTournamentMatches } from '../../hooks/useTournamentMatches';
import type { TournamentMatch } from '../../types';
import styles from './TournamentMatches.module.css';

function roundLabel(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Финал';
  if (matchesInRound === 2) return 'Хагас шигшээ';
  return `Шөвгийн ${matchesInRound * 2}`;
}

function statusLabel(match: TournamentMatch): { text: string; className: string } {
  if (match.status === 'finished' || match.winner) return { text: 'Дууссан', className: styles.finished };
  if (match.has_room) return { text: 'Лобби нээлттэй', className: styles.open };
  return { text: 'Товлогдсон', className: styles.pending };
}

function TeamRow({ name, won }: { name: string | null; won: boolean }) {
  return (
    <div className={`${styles.team} ${name ? '' : styles.tbd} ${won ? styles.won : ''}`}>
      <span className={styles.avatar} aria-hidden="true">
        {name ? name.charAt(0).toUpperCase() : '?'}
      </span>
      <span className={styles.name}>{name ?? 'Тодорхойгүй'}</span>
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

  const rounds = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    for (const m of matches) {
      const list = map.get(m.round_index) ?? [];
      list.push(m);
      map.set(m.round_index, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([roundIndex, list]) => ({
        roundIndex,
        matches: list.sort((a, b) => a.position - b.position),
      }));
  }, [matches]);
  const totalRounds = rounds.length;

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
  if (rounds.length === 0) {
    return <p className={styles.state}>Тоглолтын хуваарь удахгүй зарлагдана.</p>;
  }

  return (
    <div className={styles.rounds}>
      {rounds.map(({ roundIndex, matches: list }) => {
        const matchesInRound = 2 ** (totalRounds - 1 - roundIndex);
        return (
          <section key={roundIndex} aria-label={roundLabel(matchesInRound)}>
            <h3 className={styles.roundTitle}>{roundLabel(matchesInRound)}</h3>
            <ul className={styles.list}>
              {list.map((m) => {
                const status = statusLabel(m);
                return (
                  <li key={m.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.matchNo}>Тоглолт {m.position + 1}</span>
                      <span className={`${styles.badge} ${status.className}`}>{status.text}</span>
                    </div>
                    <TeamRow name={m.team_a} won={!!m.winner && m.winner === m.team_a} />
                    <TeamRow name={m.team_b} won={!!m.winner && m.winner === m.team_b} />
                    {m.draft_url ? (
                      <a
                        className={`btn btn-primary ${styles.joinBtn}`}
                        href={m.draft_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Join Lobby
                      </a>
                    ) : (
                      !m.has_room && <p className={styles.note}>Лобби хараахан нээгдээгүй байна.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
