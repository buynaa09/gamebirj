import type { SortKey } from '../../types';
import styles from './SortSelect.module.css';

interface SortSelectProps {
  shown: number;
  total: number;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

export function SortSelect({ shown, total, sort, onSortChange }: SortSelectProps) {
  return (
    <div className={styles.resultsRow}>
      <span>
        Showing <b>{shown}</b> of <b>{total}</b> listings
      </span>
      <select
        className={styles.sortSelect}
        aria-label="Sort listings"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
      >
        <option value="newest">Шинэ эхэнд</option>
        <option value="price-asc">Үнэ: бага -{'>'} их</option>
        <option value="price-desc">Үнэ: их -{'>'} бага</option>
        <option value="oldest">Хуучин эхэнд</option>
      </select>
    </div>
  );
}
