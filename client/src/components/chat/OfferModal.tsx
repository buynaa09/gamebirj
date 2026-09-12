import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../utils/format';
import styles from './OfferModal.module.css';

interface OfferModalProps {
  askingPrice: number;
  onClose: () => void;
  onSend: (amount: number) => Promise<void>;
}

export function OfferModal({ askingPrice, onClose, onSend }: OfferModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Санал болгох үнэ 0-ээс их байх ёстой.');
      return;
    }
    setError(null);
    setSending(true);
    onSend(value).then(onClose, (err: unknown) => {
      setSending(false);
      setError(err instanceof Error ? err.message : 'Санал илгээж чадсангүй.');
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
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Санал болгох">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Хаах">
          ✕
        </button>
        <h2 className={styles.title}>Санал болгох</h2>
        <p className={styles.sub}>
          Зарах үнэ {formatPrice(askingPrice)}. Доор санал болговол зарагч 48 цагийн дотор
          хариулах ёстой.
        </p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Санал болгох үнэ (₮)</span>
          <input
            ref={inputRef}
            className={styles.amount}
            type="number"
            min="1"
            step="any"
            inputMode="decimal"
            placeholder="Үнэ оруулна уу"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            aria-label="Санал болгох үнэ"
          />
        </label>
        <p className={styles.note}>
          Хэрэв зөвшөөрвөл үнэ 24 цагийн турш таны мэдэлд байх бөгөөд төлбөр автоматаар
          тооцогдоно.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={sending}>
            Болих
          </button>
          <button
            type="button"
            className={`btn btn-primary ${styles.sendBtn}`}
            onClick={submit}
            disabled={sending}
          >
            {sending ? 'Илгээж байна…' : 'Санал илгээх'}
          </button>
        </div>
      </div>
    </div>
  );
}
