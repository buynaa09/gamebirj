import { pillGames } from '../../data/games';
import styles from './GamePillFilter.module.css';

interface GamePillFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function GamePillFilter({ activeFilter, onFilterChange }: GamePillFilterProps) {
  return (
    <div className={styles.pillRow} role="tablist" aria-label="Filter by game">
      {pillGames.map(game => (
        <button
          key={game.id}
          className={`${styles.pill} ${activeFilter === game.id ? styles.active : ''}`}
          role="tab"
          aria-selected={activeFilter === game.id}
          onClick={() => onFilterChange(game.id)}
        >
          {game.icon && <span>{game.icon}</span>}
          {game.name}
          <span className={styles.n}>{game.count}</span>
        </button>
      ))}
    </div>
  );
}
