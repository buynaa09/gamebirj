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
        Нийт <b>{total}</b> зарнаас <b>{shown}</b>-г харуулж байна
      </span>
      <select
        className={styles.sortSelect}
        aria-label="Заруудыг эрэмбэлэх"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
      >
        <option value="newest">Шинэ нь эхэндээ</option>
        <option value="price-asc">Үнэ: Багаас их рүү</option>
        <option value="price-desc">Үнэ: Ихээс бага руу</option>
        <option value="oldest">Хуучин нь эхэндээ</option>
      </select>
    </div>
  );
}