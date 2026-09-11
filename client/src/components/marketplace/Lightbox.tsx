import { useEffect } from 'react';
import styles from './Lightbox.module.css';

interface LightboxProps {
  photos: string[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function Lightbox({ photos, index, title, onIndexChange, onClose }: LightboxProps) {
  const total = photos.length;
  const shown = ((index % total) + total) % total;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndexChange((shown + 1) % total);
      if (e.key === 'ArrowLeft') onIndexChange((shown + total - 1) % total);
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose, onIndexChange, shown, total]);

  if (total === 0) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <button type="button" className={styles.closeBtn} aria-label="Зураг хаах" onClick={onClose}>
        ✕
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.prev}`}
            aria-label="Өмнөх зураг"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((shown + total - 1) % total);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Дараах зураг"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((shown + 1) % total);
            }}
          >
            ›
          </button>
          <span className={styles.counter}>
            {shown + 1} / {total}
          </span>
        </>
      )}
      <img
        src={photos[shown]}
        alt={title}
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
