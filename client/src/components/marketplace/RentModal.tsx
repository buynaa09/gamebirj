import { useEffect, useState } from 'react';
import { formatPrice, rentalUnitLabel } from '../../utils/format';
import type { RentalOrder, RentalUnit } from '../../types';
import styles from './BuyModal.module.css';

interface RentModalProps {
  price: number;
  unit: RentalUnit;
  onClose: () => void;
  onConfirm: (duration: number) => Promise<RentalOrder>;
  onDone: (order: RentalOrder) => void;
}

export function RentModal({ price, unit, onClose, onConfirm, onDone }: RentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirm = () => {
    if (!Number.isInteger(duration) || duration < 1) {
      setError('Хугацаа хамгийн багадаа 1 байх ёстой.');
      return;
    }
    setError(null);
    setPaying(true);
    onConfirm(duration).then(onDone, (err: unknown) => {
      setPaying(false);
      setError(err instanceof Error ? err.message : 'Түрээс амжилтгүй боллоо.');
    });
  };

  const total = price * Math.max(1, Math.floor(duration) || 1);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Түрээслэх">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Хаах">
          ✕
        </button>
        <h2 className={styles.title}>Баталгаатай түрээслэх</h2>
        <p className={styles.amount}>
          {formatPrice(price)}/{rentalUnitLabel(unit)}
        </p>
        <label className={styles.durationRow} htmlFor="rent-duration">
          Хугацаа ({rentalUnitLabel(unit)}-аар)
          <input
            id="rent-duration"
            type="number"
            min={1}
            max={365}
            step={1}
            value={duration}
            disabled={paying}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <p className={styles.sub}>
          Нийт: {formatPrice(total)} ({duration} {rentalUnitLabel(unit)}). Мөнгө дундын
          дансанд хадгалагдаж, түрээс дуусахад аккаунтыг буцааж хүлээлгэн өгнө.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={paying}>
            Болих
          </button>
          <button
            type="button"
            className={`btn btn-primary ${styles.payBtn}`}
            onClick={confirm}
            disabled={paying}
          >
            {paying ? 'Төлж байна…' : 'Төлж түрээслэх'}
          </button>
        </div>
      </div>
    </div>
  );
}
