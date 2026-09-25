import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';
import { useTournaments } from '../hooks/useTournaments';
import { effectiveTournamentStatus } from '../utils/tournaments';
import type { Tournament, TournamentStatus } from '../types';
import styles from './TournamentsPage.module.css';

type TournamentSort = 'newest' | 'oldest';

const SECTIONS: { key: TournamentStatus; label: string }[] = [
  { key: 'open', label: 'Нээлттэй' },
  { key: 'live', label: 'Явагдаж буй' },
  { key: 'finished', label: 'Дууссан' },
];

function sortTournaments(tournaments: Tournament[], sort: TournamentSort): Tournament[] {
  const result = [...tournaments];
  const timeOf = (t: Tournament) => {
    const time = t.starts_at ? new Date(t.starts_at).getTime() : Number.NaN;
    return Number.isNaN(time) ? null : time;
  };
  switch (sort) {
    case 'newest':
      return result.sort((a, b) => (timeOf(b) ?? -1) - (timeOf(a) ?? -1) || b.id - a.id);
    case 'oldest':
      return result.sort(
        (a, b) => (timeOf(a) ?? Number.MAX_SAFE_INTEGER) - (timeOf(b) ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }
}

function formatStartsAt(startsAt: string | null, status: TournamentStatus): string {
  if (!startsAt) {
    return status === 'live' ? 'Явагдаж байна' : status === 'finished' ? 'Дууссан' : 'Товлогдоогүй';
  }
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt;
  return new Intl.DateTimeFormat('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function TournamentsPage() {
  const { tournaments, loading, error, reload } = useTournaments();
  const navigate = useNavigate();

  const sections = useMemo(() => {
    const groups: Record<TournamentStatus, Tournament[]> = { open: [], live: [], finished: [] };
    for (const t of tournaments) {
      groups[effectiveTournamentStatus(t.status, t.starts_at)].push(t);
    }
    return SECTIONS.map((s) => ({
      ...s,
      items: sortTournaments(groups[s.key], 'newest'),
    })).filter((s) => s.items.length > 0);
  }, [tournaments]);

  return (
    <main className={styles.page}>
      <Seo
        title="Тэмцээн — Тоглоомын тэмцээнүүд | GameBirj"
        description="GameBirj тэмцээн: Mobile Legends, PUBG, Valorant болон бусад тоглоомын шагналын сантай тэмцээнд бүртгүүлж өрсөлдөөрэй."
        path="/tournaments"
      />
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp; <span className={styles.cur}>Тэмцээн</span>
      </div>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>GameBirj тэмцээнүүд</p>
          <p className={styles.subtitle}>
            Шагналын сантай тэмцээнд багаараа оролцож, ур чадвараа сориорой.
          </p>
        </div>
      </header>

      {loading && tournaments.length === 0 ? (
        <p className={styles.empty}>Тэмцээнүүд ачааллаж байна…</p>
      ) : error && tournaments.length === 0 ? (
        <p className={styles.empty}>
          {error}{' '}
          <button type="button" className={styles.retry} onClick={reload}>
            Дахин оролдох
          </button>
        </p>
      ) : sections.length === 0 ? (
        <p className={styles.empty}>Одоогоор тэмцээн алга байна.</p>
      ) : (
        sections.map((section) => (
          <section key={section.key} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2
                className={`${styles.sectionTitle} ${section.key === 'live' ? styles.sectionLive : ''}`}
              >
                {section.label}
              </h2>
              <span className={styles.sectionCount}>{section.items.length}</span>
            </div>

            <div className={styles.grid}>
              {section.items.map((t) => (
                <article
                  key={t.id}
                  className={styles.card}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                    navigate(`/tournaments/${t.id}`);
                  }}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.game}>{t.game}</span>
                  </div>
                  <h3 className={styles.cardTitle}>
                    <Link to={`/tournaments/${t.id}`}>{t.title}</Link>
                  </h3>
                  <dl className={styles.meta}>
                    <div>
                      <dt>Шагналын сан</dt>
                      <dd className={styles.prize}>{t.prize_pool}</dd>
                    </div>
                    <div>
                      <dt>Оролцооны хураамж</dt>
                      <dd>{t.entry_fee}</dd>
                    </div>
                    <div>
                      <dt>Эхлэх</dt>
                      <dd>{formatStartsAt(t.starts_at, t.status)}</dd>
                    </div>
                    <div>
                      <dt>Оролцогч</dt>
                      <dd>
                        {t.total_slots} {t.slot_unit}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
