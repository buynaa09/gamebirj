import { ClockIcon, CheckIcon } from '../icons/Icons';
import type { DeliveryMethod } from '../../hooks/useSellDraft';
import styles from './DeliveryStep.module.css';

interface DeliveryStepProps {
  value: DeliveryMethod | null;
  onChange: (method: DeliveryMethod) => void;
}

const OPTIONS: { id: DeliveryMethod; title: string; body: string }[] = [
  {
    id: 'manual',
    title: 'Manual handover',
    body: 'You hand over the login details through Midman chat after the buyer pays. Best for most accounts.',
  },
  {
    id: 'instant',
    title: 'Instant delivery',
    body: 'Buyers receive the credentials automatically, right after payment is confirmed.',
  },
];

export function DeliveryStep({ value, onChange }: DeliveryStepProps) {
  return (
    <div>
      <h3 className={styles.heading}>Delivery</h3>
      <p className={styles.lead}>How will the buyer receive the account after payment?</p>
      <div className={styles.options} role="radiogroup" aria-label="Delivery method">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            className={`${styles.card} ${value === opt.id ? styles.cardSelected : ''}`}
            onClick={() => onChange(opt.id)}
          >
            <span className={styles.icon}>{opt.id === 'manual' ? <ClockIcon size={20} /> : <CheckIcon size={20} />}</span>
            <span className={styles.text}>
              <span className={styles.title}>{opt.title}</span>
              <span className={styles.body}>{opt.body}</span>
            </span>
            <span className={styles.radio} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
