import { Fragment } from 'react';
import styles from './StepIndicator.module.css';

const STEPS = ['Тоглоом', 'Мэдээлэл', 'Зураг', 'Шалгах'];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className={styles.steps} aria-label="Sell progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <Fragment key={label}>
            {index > 0 && <li className={styles.connector} aria-hidden="true" />}
            <li
              aria-label={`${index + 1}. ${label}`}
              aria-current={active ? 'step' : undefined}
              className={`${styles.step} ${active ? styles.active : ''} ${done ? styles.done : ''}`}
            >
              <span className={styles.dot} aria-hidden="true">
                {done ? '✓' : index + 1}
              </span>
              {active && <span className={styles.label}>{label}</span>}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
