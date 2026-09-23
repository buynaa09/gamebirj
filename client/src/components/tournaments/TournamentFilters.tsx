import styles from './TournamentFilters.module.css';

export type TournamentFeeFilter = 'all' | 'free' | 'paid';
export type TournamentStatusFilter = 'all' | 'open' | 'live' | 'finished';

interface TournamentFiltersProps {
  status: TournamentStatusFilter;
  onStatusChange: (status: TournamentStatusFilter) => void;
  fee: TournamentFeeFilter;
  onFeeChange: (fee: TournamentFeeFilter) => void;
  onReset: () => void;
  className?: string;
}

const STATUS_OPTIONS: { value: TournamentStatusFilter; label: string }[] = [
  { value: 'all', label: 'Бүгд' },
  { value: 'open', label: 'Бүртгэл нээлттэй' },
  { value: 'live', label: 'Явагдаж буй' },
  { value: 'finished', label: 'Дууссан' },
];

const FEE_OPTIONS: { value: TournamentFeeFilter; label: string }[] = [
  { value: 'all', label: 'Бүгд' },
  { value: 'free', label: 'Үнэгүй' },
  { value: 'paid', label: 'Төлбөртэй' },
];

export function TournamentFilters({
  status,
  onStatusChange,
  fee,
  onFeeChange,
  onReset,
  className,
}: TournamentFiltersProps) {
  return (
    <aside className={`${styles.filters} ${className ?? ''}`} aria-label="Тэмцээний шүүлтүүр">
      <h4>
        Шүүлтүүр
        <button type="button" className={styles.reset} onClick={onReset}>
          Цэвэрлэх
        </button>
      </h4>

      <p className={styles.groupTitle}>Төлөв</p>
      {STATUS_OPTIONS.map((opt) => (
        <label key={opt.value} className={styles.fltRow}>
          <span className={styles.left}>
            <input
              type="radio"
              name="tournament-status"
              checked={status === opt.value}
              onChange={() => onStatusChange(opt.value)}
            />
            {opt.label}
          </span>
        </label>
      ))}

      <p className={styles.groupTitle}>Оролцооны хураамж</p>
      {FEE_OPTIONS.map((opt) => (
        <label key={opt.value} className={styles.fltRow}>
          <span className={styles.left}>
            <input
              type="radio"
              name="tournament-fee"
              checked={fee === opt.value}
              onChange={() => onFeeChange(opt.value)}
            />
            {opt.label}
          </span>
        </label>
      ))}
    </aside>
  );
}
