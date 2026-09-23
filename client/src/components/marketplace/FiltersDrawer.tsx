import { useEffect } from 'react';
import type { ReactNode } from 'react';
import styles from './FiltersDrawer.module.css';

interface FiltersDrawerProps {
  resultCount: number;
  resultNoun?: string;
  onClose: () => void;
  children: ReactNode;
}

export function FiltersDrawer({ resultCount, resultNoun = 'зар', onClose, children }: FiltersDrawerProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Шүүлтүүр"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <b>Шүүлтүүр</b>
          <button type="button" className={styles.closeBtn} aria-label="Шүүлтүүр хаах" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {resultCount} {resultNoun} харах
          </button>
        </div>
      </div>
    </div>
  );
}
