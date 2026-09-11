import { SearchIcon, FilterIcon } from '../icons/Icons';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
}

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <div className={styles.searchRow}>
      <div className={styles.searchBox}>
        <SearchIcon size={15} />
        <input
          type="text"
          placeholder="Search by title, game, rank, or item…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          aria-label="Search listings"
        />
      </div>
      <button className={styles.filtersMobileBtn} aria-label="Open filters">
        <FilterIcon />
        Filters
      </button>
    </div>
  );
}
