import { useEffect, useState } from 'react';
import type { Tournament } from '../../types';
import { saveAcceptedRules } from '../../utils/tournaments';
import styles from './JoinTournamentModal.module.css';

interface JoinTournamentModalProps {
  tournament: Pick<Tournament, 'id' | 'title' | 'game' | 'rules'>;
  onClose: () => void;
  onConfirmed: () => void;
}

export function JoinTournamentModal({ tournament, onClose, onConfirmed }: JoinTournamentModalProps) {
  const [agreed, setAgreed] = useState(false);

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

  const rulesLines = tournament.rules
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const confirm = () => {
    if (!agreed) return;
    saveAcceptedRules(tournament.id);
    onConfirmed();
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Тэмцээний дүрэм"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>{tournament.game}</p>
            <h3 className={styles.title}>Тэмцээний дүрэм</h3>
            <p className={styles.sub}>{tournament.title}</p>
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>

        {rulesLines.length === 0 ? (
          <p className={styles.empty}>Дүрэм удахгүй нийтлэгдэнэ.</p>
        ) : (
          <ol className={styles.rulesList}>
            {rulesLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
        )}

        <label className={styles.agree}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>Дүрмийг уншиж, зөвшөөрч байна</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Болих
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirm}
            disabled={!agreed}
          >
            Лоббид орох
          </button>
        </div>
      </div>
    </div>
  );
}
