import { useState } from 'react';
import { useGames } from '../../hooks/useGames';
import type { MarketAccount } from '../../types';
import { formatPrice } from '../../utils/format';
import styles from './FiltersSidebar.module.css';

interface FiltersSidebarProps {
  accounts: MarketAccount[];
  minPrice: number | null;
  maxPrice: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  selectedGames: string[];
  onToggleGame: (gameName: string) => void;
  selectedRank: string | null;
  onRankChange: (value: string | null) => void;
  listingFilters: Record<number, string>;
  onListingFilterChange: (listingId: number, value: string) => void;
  className?: string;
}

function PriceInput({
  value,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  value: number | null;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // Blurred: show formatted value with ₮. Focused: raw digits for editing.
  const shown = focused ? text : value === null ? '' : formatPrice(value);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={shown}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '');
        setText(digits);
        onCommit(digits === '' ? null : Number(digits));
      }}
      onFocus={() => {
        setFocused(true);
        setText(value === null ? '' : String(value));
      }}
      onBlur={() => {
        setFocused(false);
      }}
    />
  );
}

export function FiltersSidebar({
  accounts,
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  selectedGames,
  onToggleGame,
  selectedRank,
  onRankChange,
  listingFilters,
  onListingFilterChange,
  className,
}: FiltersSidebarProps) {
  const games = useGames();
  const counts = new Map<string, number>();
  for (const account of accounts) {
    if (account.game) counts.set(account.game, (counts.get(account.game) ?? 0) + 1);
  }
  // Single-select: at most one game drives the extra per-game filters.
  const selectedGame = selectedGames.length === 1 ? games.find((g) => g.name === selectedGames[0]) : undefined;

  return (
    <aside className={className ? `${styles.filters} ${className}` : styles.filters}>
      <h4>Шүүлтүүр</h4>

      <div className={styles.groupTitle}>Тоглоом</div>
      {games.map((game) => {
        const checked = selectedGames.includes(game.name);
        return (
          <label key={game.name} className={styles.fltRow}>
            <span className={styles.left}>
              <input
                type="radio"
                name="game-filter"
                checked={checked}
                onChange={() => onToggleGame(game.name)}
                // Radios don't fire onChange when re-clicking the active one;
                // handle it so clicking the active game clears back to all.
                onClick={() => {
                  if (checked) onToggleGame(game.name);
                }}
              />
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
            <span className={styles.count}>{counts.get(game.name) ?? 0}</span>
          </label>
        );
      })}
      <span className={styles.seeAll}>Нийт {games.length} тоглоомыг харах</span>

      {selectedGame && selectedGame.ranks.length > 0 && (
        <>
          <div className={styles.groupTitle}>Ранк / Түвшин</div>
          <select
            aria-label="Filter by rank"
            className={styles.select}
            value={selectedRank ?? ''}
            onChange={(e) => onRankChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Бүх ранк</option>
            {selectedGame.ranks.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </>
      )}

      {selectedGame &&
        selectedGame.listings.map((listing) =>
          listing.listing_type === 'choice' ? (
            <div key={listing.id}>
              <div className={styles.groupTitle}>{listing.title}</div>
              <select
                aria-label={`Filter by ${listing.title}`}
                className={styles.select}
                value={listingFilters[listing.id] ?? ''}
                onChange={(e) => onListingFilterChange(listing.id, e.target.value)}
              >
                <option value="">Бүгд</option>
                {listing.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div key={listing.id}>
              <div className={styles.groupTitle}>{listing.title}</div>
              <input
                type="text"
                aria-label={`Filter by ${listing.title}`}
                className={styles.textInput}
                placeholder={listing.place_holder_value ?? listing.title}
                value={listingFilters[listing.id] ?? ''}
                onChange={(e) => onListingFilterChange(listing.id, e.target.value)}
              />
            </div>
          ),
        )}

      <div className={styles.groupTitle}>Үнийн хэмжээ</div>
      <div className={styles.priceInputs}>
        <PriceInput value={minPrice} placeholder="0₮" ariaLabel="Minimum price" onCommit={onMinChange} />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <PriceInput value={maxPrice} placeholder="100,000₮" ariaLabel="Maximum price" onCommit={onMaxChange} />
      </div>
    </aside>
  );
}
