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
        <option>Newest first</option>
        <option>Price: low to high</option>
        <option>Price: high to low</option>
      </select>
    </div>
  );
}
