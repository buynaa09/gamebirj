import { sidebarGames } from '../../data/games';
import styles from './FiltersSidebar.module.css';

export function FiltersSidebar() {
  return (
    <aside className={styles.filters}>
      <h4>Filters</h4>

      <div className={styles.groupTitle}>Game</div>
      {sidebarGames.map(game => (
        <label key={game.id} className={styles.fltRow}>
          <span className={styles.left}>
            <input type="checkbox" /> {game.name}
          </span>
          <span className={styles.count}>{game.count}</span>
        </label>
      ))}
      <span className={styles.seeAll}>See all 43 games</span>

      <div className={styles.groupTitle}>Price range</div>
      <div className={styles.priceInputs}>
        <input type="text" defaultValue="₱ 0" />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <input type="text" defaultValue="₱ 50,000+" />
      </div>
      <input className={styles.range} type="range" min={0} max={100} defaultValue={55} />

      <div className={styles.groupTitle}>Delivery method</div>
      <label className={styles.fltRow}>
        <span className={styles.left}>
          <input type="checkbox" /> Manual handover
        </span>
      </label>
      <label className={styles.fltRow}>
        <span className={styles.left}>
          <input type="checkbox" /> Instant delivery
        </span>
      </label>
    </aside>
  );
}
