import { useState } from 'react';
import { ChatBubbleIcon, ComposeIcon, SearchIcon } from '../components/icons/Icons';
import styles from './MessagesPage.module.css';

interface Thread {
  id: number;
  name: string;
  game: string;
  price: string;
  time: string;
}

const THREADS: Thread[] = [
  { id: 1, name: 'Yash Mercedes', game: 'Roblox', price: '49.00₮', time: '20 цагийн өмнө' },
];

const FILTERS = [
  { key: 'All', label: 'Бүгд' },
  { key: 'Active trade', label: 'Идэвхтэй арилжаа' },
  { key: 'Buying', label: 'Худалдан авч буй' },
  { key: 'Selling', label: 'Зарж буй' },
  { key: 'Closed', label: 'Хаагдсан' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export function MessagesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('All');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const visible = THREADS.filter((t) => {
    if (filter !== 'All') return true;
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.game.toLowerCase().includes(q);
  });

  return (
    <main className={styles.page}>
      <section className={styles.listPanel} aria-label="Харилцан ярианууд">
        <div className={styles.listHead}>
          <h1 className={styles.title}>Зурвасууд</h1>
          <button className={styles.composeBtn} aria-label="Шинэ зурвас">
            <ComposeIcon />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon size={15} />
          </span>
          <input
            className={styles.search}
            type="search"
            placeholder="Нэр эсвэл тоглоомоор хайх"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Нэр эсвэл тоглоомоор хайх"
          />
        </div>

        <div className={styles.pills} role="tablist" aria-label="Харилцан яриа шүүх">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`${styles.pill} ${filter === f.key ? styles.pillActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.threads}>
          {visible.map((t) => (
            <button
              key={t.id}
              className={`${styles.thread} ${selectedId === t.id ? styles.threadActive : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span className={styles.threadMeta}>
                <span className={styles.threadName}>{t.name}</span>
                <span className={styles.threadSub}>
                  {t.game} • {t.price}
                </span>
              </span>
              <span className={styles.threadTime}>{t.time}</span>
            </button>
          ))}
          {visible.length === 0 && <p className={styles.noResults}>Харилцан яриа олдсонгүй.</p>}
        </div>
      </section>

      <section className={styles.detailPanel} aria-label="Зурвасын дэлгэрэнгүй">
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ChatBubbleIcon size={20} />
          </span>
          <p className={styles.emptyTitle}>Харилцан яриа сонгоно уу</p>
          <p className={styles.emptySub}>Зүүн талын жагсаалтаас сонгож зурвасууд болон арилжааны дэлгэрэнгүйг харна уу.</p>
        </div>
      </section>
    </main>
  );
}