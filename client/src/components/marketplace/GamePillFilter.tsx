import { gameIcons } from '../../data/games';
import { listings } from '../../data/listings';
import { useGames } from '../../hooks/useGames';
import styles from './GamePillFilter.module.css';

interface GamePillFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function GamePillFilter({ activeFilter, onFilterChange }: GamePillFilterProps) {
  const games = useGames();

  const pills = [
    { id: 'all', name: 'All games', icon: undefined, image: null, count: listings.length },
    ...games.map((game) => ({
      id: game.name,
      name: game.name,
      icon: gameIcons[game.name],
      image: game.image,
      count: listings.filter((l) => l.game === game.name).length,
    })),
  ];

  return (
    <div className={styles.pillRow} role="tablist" aria-label="Filter by game">
      {pills.map((game) => (
        <button
          key={game.id}
          className={`${styles.pill} ${activeFilter === game.id ? styles.active : ''}`}
          role="tab"
          aria-selected={activeFilter === game.id}
          onClick={() => onFilterChange(game.id)}
        >
          {game.image ? (
            <img
              src={game.image}
              alt=""
              className={styles.gameIcon}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            game.icon && <span>{game.icon}</span>
          )}
          {game.name}
          <span className={styles.n}>{game.count}</span>
        </button>
      ))}
    </div>
  );
}
