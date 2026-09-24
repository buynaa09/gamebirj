import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import styles from './LobbyModal.module.css';

interface LobbyModalProps {
  title: string;
  game: string;
  lobbyUrl: string;
  onClose: () => void;
}

export function LobbyModal({ title, game, lobbyUrl, onClose }: LobbyModalProps) {
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(lobbyUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Лобби холбоос"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>{game}</p>
            <h3 className={styles.title}>Лобби нээлттэй</h3>
            <p className={styles.sub}>{title}</p>
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.qrWrap}>
          <QRCode value={lobbyUrl} size={180} aria-label="Лобби QR код" />
        </div>
        {/* <p className={styles.url}>{lobbyUrl}</p> */}

        <div className={styles.actions}>
          <a
            className="btn btn-primary"
            href={lobbyUrl}
            target="_blank"
            rel="noreferrer"
          >
            Лобби орох
          </a>
          <button type="button" className="btn btn-outline" onClick={copyLink}>
            {copied ? '✓ Хуулагдлаа' : 'Link хуулах'}
          </button>
        </div>
      </div>
    </div>
  );
}
