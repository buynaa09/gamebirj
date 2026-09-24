import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/react';
import { Seo } from '../components/seo/Seo';
import { RegisterTeamModal } from '../components/tournaments/RegisterTeamModal';
import { JoinTournamentModal } from '../components/tournaments/JoinTournamentModal';
import { TournamentBracket } from '../components/tournaments/TournamentBracket';
import { useTournament } from '../hooks/useTournament';
import { useTournaments } from '../hooks/useTournaments';
import { hasAcceptedRules, tournamentStarted } from '../utils/tournaments';
import { useGames } from '../hooks/useGames';
import { gameIcons } from '../data/games';
import type { TournamentStatus } from '../types';
import styles from './TournamentDetailPage.module.css';

const STATUS_META: Record<TournamentStatus, { label: string; className: string }> = {
  open: { label: 'Бүртгэл нээлттэй', className: 'open' },
  live: { label: 'Явагдаж байна', className: 'live' },
  finished: { label: 'Дууссан', className: 'finished' },
};

type DetailTab = 'overview' | 'stages' | 'matches' | 'participants' | 'rules';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: 'Тойм' },
  { key: 'stages', label: 'Шат' },
  { key: 'matches', label: 'Тоглолтууд' },
  { key: 'participants', label: 'Багууд' },
  { key: 'rules', label: 'Дүрэм' },
];

function formatDay(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function timezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const city = zone.split('/').pop()?.replace(/_/g, ' ') ?? '';
  return `${city} (UTC${sign}${hh}:${mm})`;
}

export function TournamentDetailPage({ id }: { id: number }) {
  const { tournament, loading, error, reload } = useTournament(id);
  const { tournaments } = useTournaments();
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const apiGames = useGames();
  const locationState = useLocation().state as { tab?: string } | null;
  const [tab, setTab] = useState<DetailTab>(
    locationState?.tab === 'matches' ? 'matches' : 'overview',
  );
  const [registerOpen, setRegisterOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [shared, setShared] = useState(false);

  const handleRegister = () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setRegisterOpen(true);
  };

  const handleJoin = () => {
    if (hasAcceptedRules(id)) {
      setTab('matches');
      return;
    }
    setJoinOpen(true);
  };

  if (loading && !tournament) {
    return (
      <main className={styles.page}>
        <Seo
          title="Тэмцээн уншиж байна… | GameBirj"
          description="GameBirj тэмцээний дэлгэрэнгүй."
          path={`/tournaments/${id}`}
          noindex
        />
        <p className={styles.state}>Уншиж байна…</p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className={styles.page}>
        <Seo
          title="Тэмцээн олдсонгүй | GameBirj"
          description="Хайсан тэмцээн олдсонгүй."
          path={`/tournaments/${id}`}
          noindex
        />
        <p className={styles.state}>Тэмцээний мэдээллийг ачаалж чадсангүй ({error ?? 'олдсонгүй'}).</p>
        <Link className="btn btn-outline" to="/tournaments">
          Тэмцээнүүд рүү буцах
        </Link>
      </main>
    );
  }

  const meta = STATUS_META[tournament.status];
  const pct =
    tournament.total_slots > 0
      ? Math.round((tournament.filled_slots / tournament.total_slots) * 100)
      : 0;
  const similar = tournaments
    .filter((t) => t.id !== tournament.id && t.game === tournament.game)
    .slice(0, 3);
  const gameImage = apiGames.find((g) => g.name === tournament.game)?.image ?? null;
  const gameEmoji = gameIcons[tournament.game];

  const startDay = formatDay(tournament.starts_at);
  const endDay = formatDay(tournament.ends_at);
  const dateRange = startDay && endDay ? `${startDay} - ${endDay}` : (startDay || endDay || 'Товлогдоогүй');
  const fullStart = formatDateTime(tournament.starts_at);
  const fullEnd = formatDateTime(tournament.ends_at);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setShared(false);
    }
  };

  const rulesLines = tournament.rules
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <main className={styles.page}>
      <Seo
        title={`${tournament.title} | GameBirj`}
        description={`${tournament.title} — ${tournament.game} тэмцээн. Шагналын сан ${tournament.prize_pool}. Багаа бүртгүүлж өрсөлдөөрэй.`}
        path={`/tournaments/${tournament.id}`}
      />
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp; <Link to="/tournaments">Тэмцээн</Link> &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>{tournament.title}</span>
      </div>

      <header className={styles.hero}>
        {gameImage ? (
          <img src={gameImage} alt="" className={styles.heroThumb} />
        ) : (
          <div className={styles.heroThumbFallback} aria-hidden="true">
            {gameEmoji ?? tournament.game.charAt(0)}
          </div>
        )}
        <div className={styles.heroMain}>
          <h1 className={styles.title}>{tournament.title}</h1>
          <p className={styles.dateRange}>{dateRange}</p>
          <span className={`${styles.badge} ${styles[meta.className]}`}>{meta.label}</span>
        </div>
        {tournament.is_registered &&
        tournament.status !== 'finished' &&
        tournamentStarted(tournament.status, tournament.starts_at) ? (
          <button
            type="button"
            className={`btn btn-primary ${styles.heroCta}`}
            onClick={handleJoin}
          >
            Join
          </button>
        ) : (
          tournament.status === 'open' &&
          (tournament.is_registered ? (
            <button type="button" className={`btn btn-outline ${styles.heroCta}`} disabled>
              ✓ Бүртгүүлсэн
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-primary ${styles.heroCta}`}
              onClick={handleRegister}
            >
              Баг бүртгүүлэх
            </button>
          ))
        )}
      </header>

      <nav className={styles.tabs} aria-label="Тэмцээний хэсгүүд">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            aria-selected={tab === t.key}
            role="tab"
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'participants' && (
              <span className={styles.tabCount}>{tournament.registrations.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className={styles.columns}>
          <div>
            <section aria-label="Мэдээлэл">
              <h2 className={styles.sectionTitle}>Мэдээлэл</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoGame}>
                  {gameImage ? (
                    <img src={gameImage} alt="" className={styles.infoGameImg} />
                  ) : (
                    <span className={styles.infoGameEmoji}>{gameEmoji ?? '🎮'}</span>
                  )}
                  <div>
                    <b>{tournament.game}</b>
                    <span>{tournament.mode || 'Online'}</span>
                  </div>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoLabel}>Төрөл</span>
                  <b>{tournament.mode || 'Online'}</b>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoLabel}>Хэмжээ</span>
                  <b>
                    {tournament.total_slots} {tournament.slot_unit}
                    <span className={styles.infoSub}> ({tournament.team_size} тоглогч)</span>
                  </b>
                </div>
              </div>
            </section>

            <section aria-label="Шатны тойм">
              <h2 className={styles.sectionTitle}>Шат</h2>
              <div className={styles.stageCards}>
                <div className={styles.stageCard}>
                  <b>{tournament.format || 'Үндсэн шат'}</b>
                  <span>{tournament.total_slots} slot</span>
                  <span>
                    {tournament.filled_slots}/{tournament.total_slots} дүүрсэн
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div>
            <section aria-label="Хуваарь">
              <div className={styles.scheduleHead}>
                <h2 className={styles.sectionTitle}>Хуваарь</h2>
                <span className={styles.tz}>{timezoneLabel()}</span>
              </div>
              <div className={styles.scheduleCard}>
                <span className={styles.infoLabel}>Тэмцээний өдрүүд</span>
                <p>
                  {fullStart || fullEnd ? `${fullStart} - ${fullEnd}` : dateRange}{' '}
                  <span className={`${styles.badge} ${styles[meta.className]}`}>{meta.label}</span>
                </p>
                <dl className={styles.scheduleMeta}>
                  <div>
                    <dt>Шагналын сан</dt>
                    <dd className={styles.prize}>{tournament.prize_pool}</dd>
                  </div>
                  <div>
                    <dt>Оролцооны хураамж</dt>
                    <dd>{tournament.entry_fee}</dd>
                  </div>
                </dl>
                <div className={styles.progress}>
                  <div className={styles.progressBar}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressLabel}>
                    {tournament.filled_slots}/{tournament.total_slots} дүүрсэн
                  </span>
                </div>
              </div>
            </section>

            <button type="button" className={styles.shareBtn} onClick={share}>
              {shared ? '✓ Холбоос хуулагдлаа' : `⤴ Хуваалцах: ${tournament.title}`}
            </button>
          </div>
        </div>
      )}

      {tab === 'stages' && (
        <section aria-label="Шатнууд">
          <h2 className={styles.sectionTitle}>Шатнууд</h2>
        
          <TournamentBracket teams={tournament.registrations} totalSlots={tournament.total_slots} />
        </section>
      )}

      {tab === 'matches' && (
        <section aria-label="Тоглолтууд">
          <h2 className={styles.sectionTitle}>Тоглолтууд</h2>
          <p className={styles.empty}>Тоглолтын хуваарь удахгүй зарлагдана.</p>
        </section>
      )}

      {tab === 'participants' && (
        <section aria-label="Багууд">
          <h2 className={styles.sectionTitle}>
            Багууд <span className={styles.count}>{tournament.registrations.length}</span>
          </h2>
          {tournament.registrations.length === 0 ? (
            <p className={styles.empty}>Одоогоор бүртгэлтэй баг алга байна.</p>
          ) : (
            <ul className={styles.teamList}>
              {tournament.registrations.map((team, index) => (
                <li key={`${team.team_name}-${index}`}>
                  <span className={styles.teamName}>{team.team_name}</span>
                  {team.leader_nickname && (
                    <span className={styles.teamNick}>{team.leader_nickname}</span>
                  )}
                  <span className={styles.teamDate}>{formatDate(team.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'rules' && (
        <section aria-label="Дүрэм">
          <h2 className={styles.sectionTitle}>Дүрэм</h2>
          {rulesLines.length === 0 ? (
            <p className={styles.empty}>Дүрэм удахгүй нийтлэгдэнэ.</p>
          ) : (
            <ol className={styles.rulesList}>
              {rulesLines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {similar.length > 0 && (
        <section className={styles.similar} aria-label="Төстэй тэмцээнүүд">
          <h2 className={styles.sectionTitle}>Төстэй тэмцээнүүд</h2>
          <ul>
            {similar.map((t) => (
              <li key={t.id}>
                <Link to={`/tournaments/${t.id}`}>
                  <b>{t.title}</b>
                  <span>
                    {t.prize_pool} · {STATUS_META[t.status].label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {registerOpen && (
        <RegisterTeamModal
          tournament={tournament}
          onClose={() => setRegisterOpen(false)}
          onRegistered={reload}
        />
      )}
      {joinOpen && (
        <JoinTournamentModal
          tournament={tournament}
          onClose={() => setJoinOpen(false)}
          onConfirmed={() => {
            setJoinOpen(false);
            setTab('matches');
          }}
        />
      )}
    </main>
  );
}
