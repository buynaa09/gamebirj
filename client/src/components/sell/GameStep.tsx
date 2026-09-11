import { useEffect, useRef, useState } from 'react';
import { useGames } from '../../hooks/useGames';
import type { Game } from '../../types';
import styles from './GameStep.module.css';

interface GameStepProps {
  selected: string | null;
  onSelect: (gameName: string) => void;
}

export function GameStep({ selected, onSelect }: GameStepProps) {
  const games = useGames();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  const selectedGame = games.find((g) => g.name === selected) ?? null;
  const popular = games.slice(0, 6);
  const filtered = games.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = () => {
    setOpen((o) => {
      if (!o) setQuery('');
      return !o;
    });
  };

  const choose = (game: Game) => {
    onSelect(game.name);
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <h3 className={styles.heading}>Тоглоом</h3>
      <p className={styles.lead}>Аккунтынхаа тоглоомыг сонгоно уу. Энэ нь худалдан авагчдад таныг зөв ангилалаас олоход тусална.</p>

      <label className={styles.fieldLabel} htmlFor="sell-game-button">
        Тоглоом *
      </label>
      <div className={styles.combo} ref={boxRef}>
        <button
          id="sell-game-button"
          type="button"
          className={styles.comboButton}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
        >
          {selectedGame ? (
            <>
              <GameThumb game={selectedGame} size="sm" />
              <span className={styles.comboName}>{selectedGame.name}</span>
            </>
          ) : (
            <span className={styles.comboPlaceholder}>Тоглоом сонгох…</span>
          )}
          <span className={styles.chevron} aria-hidden="true">
            ↕
          </span>
        </button>
        {open && (
          <div className={styles.comboList}>
            <div className={styles.searchRow}>
              <span className={styles.searchIcon} aria-hidden="true">
                ⌕
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Тоглоом хайх…"
                aria-label="Тоглоом хайх"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <ul role="listbox" aria-label="Тоглоомууд" className={styles.optionsList}>
              {filtered.map((game) => (
                <li key={game.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={game.name === selected}
                    className={`${styles.comboOption} ${game.name === selected ? styles.selected : ''}`}
                    onClick={() => choose(game)}
                  >
                    <GameThumb game={game} size="sm" />
                    <span className={styles.comboName}>{game.name}</span>
                    {game.name === selected && <span className={styles.check}>✓</span>}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className={styles.noResults}>Тоглоом олдсонгүй</li>}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.popularTitle}>Энэ долоо хоногийн тренд</div>
      <div className={styles.popularGrid}>
        {popular.map((game) => (
          <button
            key={game.name}
            type="button"
            className={`${styles.tile} ${game.name === selected ? styles.tileSelected : ''}`}
            onClick={() => onSelect(game.name)}
            aria-pressed={game.name === selected}
          >
            <GameThumb game={game} size="lg" />
            <span className={styles.tileName}>{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GameThumb({ game, size }: { game: Game; size: 'sm' | 'lg' }) {
  if (game.image) {
    return (
      <img
        src={game.image}
        alt=""
        className={size === 'sm' ? styles.thumbSm : styles.thumbLg}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  return (
    <span className={size === 'sm' ? styles.fallbackSm : styles.fallbackLg} aria-hidden="true">
      {game.name.charAt(0).toUpperCase()}
    </span>
  );
}