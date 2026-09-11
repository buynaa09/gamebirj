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

export function FiltersSidebar({ accounts, minPrice, maxPrice, onMinChange, onMaxChange }: FiltersSidebarProps) {
  const games = useGames();
  const counts = new Map<string, number>();
  for (const account of accounts) {
    if (account.game) counts.set(account.game, (counts.get(account.game) ?? 0) + 1);
  }

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
          <span className={styles.count}>{counts.get(game.name) ?? 0}</span>
        </label>
      ))}
      <span className={styles.seeAll}>Нийт {games.length} тоглоомыг харах</span>

      <div className={styles.groupTitle}>Үнийн хэмжээ</div>
      <div className={styles.priceInputs}>
        <PriceInput value={minPrice} placeholder="0₮" ariaLabel="Minimum price" onCommit={onMinChange} />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <PriceInput value={maxPrice} placeholder="100,000₮" ariaLabel="Maximum price" onCommit={onMaxChange} />
      </div>
    </aside>
  );
}
