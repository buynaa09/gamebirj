import { useEffect, useState } from 'react';
import { formatPrice } from '../../utils/format';
import type { QPayPayment } from '../../types';
import styles from './BuyModal.module.css';

interface BuyModalProps {
  price: number;
  onClose: () => void;
  onConfirm: () => Promise<QPayPayment>;
  onDone: (payment: QPayPayment) => void;
}

export function BuyModal({ price, onClose, onConfirm, onDone }: BuyModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirm = () => {
    setError(null);
    setPaying(true);
    onConfirm().then(onDone, (err: unknown) => {
      setPaying(false);
      setError(err instanceof Error ? err.message : 'Худалдан авалт амжилтгүй боллоо.');
    });
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Худалдан авалт">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Хаах">
          ✕
        </button>
        <h2 className={styles.title}>Баталгаатай худалдан авах</h2>
        <p className={styles.amount}>{formatPrice(price)}</p>
        <p className={styles.sub}>
          Мөнгө дундын дансанд хадгалагдаж, шилжүүлэг баталгаажсаны дараа зарагчид шилжинэ.
          Зөвшөөрсөн үнэтэй бол тэр үнээр тооцогдоно.
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
            {paying ? 'Нэхэмжлэл үүсгэж байна…' : 'QPay-ээр төлөх'}
          </button>
        </div>
      </div>
    </div>
  );
}
