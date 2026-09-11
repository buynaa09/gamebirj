import { sidebarCounts } from '../../data/games';
import { useGames } from '../../hooks/useGames';
import styles from './FiltersSidebar.module.css';

export function FiltersSidebar() {
  const games = useGames();

  return (
    <aside className={styles.filters}>
      <h4>Шүүлтүүр</h4>

      <div className={styles.groupTitle}>Тоглоом</div>
      {games.map((game) => (
        <label key={game.name} className={styles.fltRow}>
          <span className={styles.left}>
            <input type="checkbox" />
            {game.image && (
              <img
                src={game.image}
                alt=""
                className={styles.gameThumb}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className={styles.gameName}>{game.name}</span>
          </span>
          <span className={styles.count}>{sidebarCounts[game.name] ?? 0}</span>
        </label>
      ))}
      <span className={styles.seeAll}>See all {games.length} games</span>

      <div className={styles.groupTitle}>Үнийн хэмжээ</div>
      <div className={styles.priceInputs}>
        <input type="text" defaultValue="0₮" />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <input type="text" defaultValue="100,000₮" />
      </div>

     
    </aside>
  );
}
