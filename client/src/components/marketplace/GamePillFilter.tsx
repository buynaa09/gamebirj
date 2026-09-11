import { gameIcons } from '../../data/games';
import { useGames } from '../../hooks/useGames';
import type { MarketAccount } from '../../types';
import styles from './GamePillFilter.module.css';

interface GamePillFilterProps {
  selectedGames: string[];
  onSelectGame: (gameName: string) => void;
  accounts: MarketAccount[];
}

function countFor(accounts: MarketAccount[], gameName: string): number {
  return accounts.filter((a) => a.game === gameName).length;
}

export function GamePillFilter({ selectedGames, onSelectGame, accounts }: GamePillFilterProps) {
  const games = useGames();

  const isActive = (id: string) =>
    id === 'all' ? selectedGames.length === 0 : selectedGames.length === 1 && selectedGames[0] === id;

  const pills = [
    { id: 'all', name: 'All games', icon: undefined, image: null, count: accounts.length },
    ...games.map((game) => ({
      id: game.name,
      name: game.name,
      icon: gameIcons[game.name],
      image: game.image,
      count: countFor(accounts, game.name),
    })),
  ];

  return (
    <div className={styles.pillRow} role="tablist" aria-label="Filter by game">
      {pills.map((game) => (
        <button
          key={game.id}
          className={`${styles.pill} ${isActive(game.id) ? styles.active : ''}`}
          role="tab"
          aria-selected={isActive(game.id)}
          onClick={() => onSelectGame(game.id)}
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
