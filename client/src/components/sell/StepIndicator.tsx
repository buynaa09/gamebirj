import styles from './StepIndicator.module.css';

const STEPS = ['Тоглоом', 'Мэдээлэл', 'Зураг', 'Шалгах'];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className={styles.steps} aria-label="Sell progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className={`${styles.step} ${active ? styles.active : ''} ${done ? styles.done : ''}`}>
            <span className={styles.dot}>{done ? '✓' : index + 1}</span>
            <span className={styles.label}>{label}</span>
            {index < STEPS.length - 1 && <span className={styles.line} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
