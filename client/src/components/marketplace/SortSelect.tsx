import styles from './SortSelect.module.css';

interface SortSelectProps {
  total: number;
}

export function SortSelect({ total }: SortSelectProps) {
  return (
    <div className={styles.resultsRow}>
      <span>
        Showing <b>{total}</b> of <b>{total}</b> listings
      </span>
      <select className={styles.sortSelect} aria-label="Sort listings">
        <option>Шинэ эхэнд</option>
        <option>Үнэ: бага -{'>'} их</option>
        <option>Үнэ: их -{'>'} бага</option>
        <option>Хуучин эхэнд</option>
      </select>
    </div>
  );
}
