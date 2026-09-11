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
          placeholder="Гарчиг, тоглоом, ранк эсвэл зүйлээр хайх…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          aria-label="Заруудаас хайх"
        />
      </div>
      <button className={styles.filtersMobileBtn} aria-label="Шүүлтүүр нээх">
        <FilterIcon />
        Шүүлтүүр
      </button>
    </div>
  );
}