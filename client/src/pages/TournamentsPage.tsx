import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';
import styles from './TournamentsPage.module.css';

type TournamentStatus = 'open' | 'live' | 'finished';

interface Tournament {
  id: number;
  title: string;
  game: string;
  status: TournamentStatus;
  prize: string;
  entryFee: string;
  startsAt: string;
  slots: string;
  filled: number;
  total: number;
  format: string;
}

const TOURNAMENTS: Tournament[] = [
  {
    id: 1,
    title: 'GameBirj MLBB Cup — Season 1',
    game: 'Mobile Legends',
    status: 'open',
    prize: '1,000,000₮',
    entryFee: 'Үнэгүй',
    startsAt: '2026-10-05 · 19:00',
    slots: '32 баг',
    filled: 21,
    total: 32,
    format: '5v5 · Single Elimination',
  },
  {
    id: 2,
    title: 'PUBG Mobile Solo Showdown',
    game: 'PUBG Mobile',
    status: 'open',
    prize: '500,000₮',
    entryFee: '10,000₮',
    startsAt: '2026-10-12 · 18:00',
    slots: '64 тоглогч',
    filled: 37,
    total: 64,
    format: 'Solo · 3 раунд',
  },
  {
    id: 3,
    title: 'Valorant Community Clash',
    game: 'Valorant',
    status: 'live',
    prize: '750,000₮',
    entryFee: '20,000₮ / баг',
    startsAt: 'Явагдаж байна',
    slots: '16 баг',
    filled: 16,
    total: 16,
    format: '5v5 · Group + Playoff',
  },
  {
    id: 4,
    title: 'Dota 2 Amateur League',
    game: 'Dota 2',
    status: 'open',
    prize: '300,000₮',
    entryFee: 'Үнэгүй',
    startsAt: '2026-11-02 · 17:00',
    slots: '16 баг',
    filled: 6,
    total: 16,
    format: '5v5 · Double Elimination',
  },
  {
    id: 5,
    title: 'FC 25 Weekend Cup',
    game: 'EA FC 25',
    status: 'finished',
    prize: '200,000₮',
    entryFee: '5,000₮',
    startsAt: '2026-09-14 · Дууссан',
    slots: '32 тоглогч',
    filled: 32,
    total: 32,
    format: '1v1 · Single Elimination',
  },
  {
    id: 6,
    title: 'CS2 2v2 Wingman Night',
    game: 'CS2',
    status: 'finished',
    prize: '150,000₮',
    entryFee: 'Үнэгүй',
    startsAt: '2026-09-07 · Дууссан',
    slots: '16 баг',
    filled: 16,
    total: 16,
    format: '2v2 · Wingman',
  },
];

const STATUS_META: Record<TournamentStatus, { label: string; className: string }> = {
  open: { label: 'Бүртгэл нээлттэй', className: 'open' },
  live: { label: 'Явагдаж байна', className: 'live' },
  finished: { label: 'Дууссан', className: 'finished' },
};

type FilterKey = 'all' | TournamentStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Бүгд' },
  { key: 'open', label: 'Бүртгэл нээлттэй' },
  { key: 'live', label: 'Явагдаж буй' },
  { key: 'finished', label: 'Дууссан' },
];

export function TournamentsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');

  const list = useMemo(
    () => (filter === 'all' ? TOURNAMENTS : TOURNAMENTS.filter((t) => t.status === filter)),
    [filter],
  );

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
          <h1 className={styles.title}>Тэмцээн</h1>
          <p className={styles.subtitle}>
            Шагналын сантай тэмцээнд багаараа оролцож, ур чадвараа сориорой.
            Бүртгэл, хуваарь, дүн — бүгд нэг дор.
          </p>
        </div>
        <div className={styles.heroCard}>
          <span className={styles.heroPrize}>{TOURNAMENTS.length} тэмцээн</span>
          <span className={styles.heroNote}>Одоогоор идэвхтэй бүртгэлтэй</span>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Тэмцээний шүүлтүүр">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`${styles.tab} ${filter === f.key ? styles.tabActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className={styles.empty}>Энэ ангилалд тэмцээн алга байна.</p>
      ) : (
        <section className={styles.grid}>
          {list.map((t) => {
            const meta = STATUS_META[t.status];
            const pct = Math.round((t.filled / t.total) * 100);
            return (
              <article key={t.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.game}>{t.game}</span>
                  <span className={`${styles.badge} ${styles[meta.className]}`}>{meta.label}</span>
                </div>
                <h2 className={styles.cardTitle}>{t.title}</h2>
                <p className={styles.format}>{t.format}</p>
                <dl className={styles.meta}>
                  <div>
                    <dt>Шагналын сан</dt>
                    <dd className={styles.prize}>{t.prize}</dd>
                  </div>
                  <div>
                    <dt>Оролцооны хураамж</dt>
                    <dd>{t.entryFee}</dd>
                  </div>
                  <div>
                    <dt>Эхлэх</dt>
                    <dd>{t.startsAt}</dd>
                  </div>
                  <div>
                    <dt>Оролцогч</dt>
                    <dd>{t.slots}</dd>
                  </div>
                </dl>
                <div className={styles.progress}>
                  <div className={styles.progressBar}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressLabel}>
                    {t.filled}/{t.total} дүүрсэн
                  </span>
                </div>
                <div className={styles.actions}>
                  {t.status === 'open' ? (
                    <button className="btn btn-primary" type="button">
                      Бүртгүүлэх
                    </button>
                  ) : t.status === 'live' ? (
                    <button className="btn btn-outline" type="button">
                      Шууд үзэх
                    </button>
                  ) : (
                    <button className="btn btn-outline" type="button">
                      Дүн харах
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
