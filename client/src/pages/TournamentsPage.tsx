import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';
import { SearchBar } from '../components/marketplace/SearchBar';
import { FiltersDrawer } from '../components/marketplace/FiltersDrawer';
import { TournamentFilters } from '../components/tournaments/TournamentFilters';
import filterStyles from '../components/tournaments/TournamentFilters.module.css';
import type { TournamentFeeFilter } from '../components/tournaments/TournamentFilters';
import { useTournaments } from '../hooks/useTournaments';
import { effectiveTournamentStatus } from '../utils/tournaments';
import { useGames } from '../hooks/useGames';
import { gameIcons } from '../data/games';
import type { Tournament, TournamentStatus } from '../types';
import styles from './TournamentsPage.module.css';

const STATUS_META: Record<TournamentStatus, { label: string; className: string }> = {
  open: { label: 'Бүртгэл нээлттэй', className: 'open' },
  live: { label: 'Явагдаж байна', className: 'live' },
  finished: { label: 'Дууссан', className: 'finished' },
};

type FilterKey = 'all' | TournamentStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Бүгд' },
  { key: 'open', label: 'Нээлттэй' },
  { key: 'live', label: 'Явагдаж буй' },
  { key: 'finished', label: 'Дууссан' },
];

type TournamentSort = 'newest' | 'oldest';

function matchesQuery(t: Tournament, q: string): boolean {
  return (
    t.title.toLowerCase().includes(q) ||
    t.game.toLowerCase().includes(q) ||
    t.format.toLowerCase().includes(q)
  );
}

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
  const apiGames = useGames();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort] = useState<TournamentSort>('newest');
  const [fee, setFee] = useState<TournamentFeeFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const resetFilters = () => {
    setFilter('all');
    setSelectedGame('all');
    setQuery('');
    setFee('all');
  };

  const imageByGame = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of apiGames) {
      if (g.image) map.set(g.name, g.image);
    }
    return map;
  }, [apiGames]);

  const games = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tournaments) {
      counts.set(t.game, (counts.get(t.game) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({
      name,
      count,
      image: imageByGame.get(name) ?? null,
    }));
  }, [tournaments, imageByGame]);

  const list = useMemo(() => {
    let result = tournaments.filter(
      (t) =>
        (filter === 'all' || effectiveTournamentStatus(t.status, t.starts_at) === filter) &&
        (selectedGame === 'all' || t.game === selectedGame) &&
        (fee === 'all' || (fee === 'free' ? t.entry_fee === 'Үнэгүй' : t.entry_fee !== 'Үнэгүй')),
    );

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((t) => matchesQuery(t, q));
    }

    return sortTournaments(result, sort);
  }, [tournaments, filter, selectedGame, query, sort, fee]);

  const filters = (
    <TournamentFilters
      status={filter}
      onStatusChange={setFilter}
      fee={fee}
      onFeeChange={setFee}
      onReset={resetFilters}
    />
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
          <p className={styles.subtitle}>
            Шагналын сантай тэмцээнд багаараа оролцож, ур чадвараа сориорой.
          </p>
        </div>
      </header>

      <div className={styles.body}>
        {filters}
        <section className={styles.main}>
          <SearchBar query={query} onQueryChange={setQuery} onOpenFilters={() => setFiltersOpen(true)} />

          {games.length > 1 && (
            <div className={styles.pillRow} role="tablist" aria-label="Тоглоолоор шүүх">
              <button
                type="button"
                role="tab"
                aria-selected={selectedGame === 'all'}
                className={`${styles.pill} ${selectedGame === 'all' ? styles.pillActive : ''}`}
                onClick={() => setSelectedGame('all')}
              >
                Бүх тоглоом
                <span className={styles.n}>{tournaments.length}</span>
              </button>
              {games.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  role="tab"
                  aria-selected={selectedGame === g.name}
                  className={`${styles.pill} ${selectedGame === g.name ? styles.pillActive : ''}`}
                  onClick={() => setSelectedGame(selectedGame === g.name ? 'all' : g.name)}
                >
                  {g.image ? (
                    <img
                      src={g.image}
                      alt=""
                      className={styles.gameIcon}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    gameIcons[g.name] && <span>{gameIcons[g.name]}</span>
                  )}
                  {g.name}
                  <span className={styles.n}>{g.count}</span>
                </button>
              ))}
            </div>
          )}

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



      {loading && tournaments.length === 0 ? (
        <p className={styles.empty}>Тэмцээнүүд ачааллаж байна…</p>
      ) : error && tournaments.length === 0 ? (
        <p className={styles.empty}>
          {error}{' '}
          <button type="button" className={styles.retry} onClick={reload}>
            Дахин оролдох
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className={styles.empty}>Энэ ангилалд тэмцээн алга байна.</p>
      ) : (
        <section className={styles.grid}>
          {list.map((t) => {
            const status = effectiveTournamentStatus(t.status, t.starts_at);
            const meta = STATUS_META[status];
            return (
              <article
                key={t.id}
                className={styles.card}
                onClick={(e) => {
                  // Товч/линк дээр дарсан бол card navigation ажиллахгүй
                  if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                  navigate(`/tournaments/${t.id}`);
                }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.game}>{t.game}</span>
                  <span className={`${styles.badge} ${styles[meta.className]}`}>{meta.label}</span>
                </div>
                <h2 className={styles.cardTitle}>
                  <Link to={`/tournaments/${t.id}`}>{t.title}</Link>
                </h2>
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
            );
          })}
        </section>
      )}
        </section>
      </div>
      {filtersOpen && (
        <FiltersDrawer
          resultCount={list.length}
          resultNoun="тэмцээн"
          onClose={() => setFiltersOpen(false)}
        >
          <TournamentFilters
            status={filter}
            onStatusChange={setFilter}
            fee={fee}
            onFeeChange={setFee}
            onReset={resetFilters}
            className={filterStyles.filtersVisible}
          />
        </FiltersDrawer>
      )}
    </main>
  );
}
