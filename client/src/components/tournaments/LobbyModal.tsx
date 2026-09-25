import { useEffect, useRef, useState } from 'react';
import camp1Image from '../../assets/tournaments/right.jpeg';
import camp2Image from '../../assets/tournaments/left.jpeg';
import styles from './LobbyModal.module.css';

interface LobbyModalProps {
  title: string;
  game: string;
  lobbyUrl: string;
  camp: number | null;
  deadline: string | null;
  onClose: () => void;
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function LobbyModal({ title, game, lobbyUrl, camp, deadline, onClose }: LobbyModalProps) {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(deadline ? 300 : null);
  const actionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    actionRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    const update = () =>
      setRemaining(Number.isNaN(target) ? null : Math.ceil((target - Date.now()) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

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

  const expired = remaining !== null && remaining <= 0;
  const campLabel = camp === 1 || camp === 2 ? `Таны багийн тал: Camp ${camp}` : null;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Лобби холбоос"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.body}>
          <div className={styles.header}>
            <div>
              <p className={styles.kicker}>{game}</p>
              <h3 className={styles.title}>Лобби нээлттэй</h3>
              <p className={styles.sub}>{title}</p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Хаах"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {campLabel ? (
            <figure className={styles.figure}>
              <img
                className={styles.campImage}
                src={camp === 1 ? camp1Image : camp2Image}
                alt={campLabel}
              />
              <figcaption className={styles.campChip}>
                <span className={styles.campChipDot} aria-hidden="true" />
                {campLabel}
              </figcaption>
            </figure>
          ) : (
            <div className={styles.linkBlock}>
              <span className={styles.linkLabel}>Лобби холбоос</span>
              <a className={styles.linkUrl} href={lobbyUrl} target="_blank" rel="noreferrer">
                {lobbyUrl}
              </a>
            </div>
          )}

          {deadline && (
            <div
              className={`${styles.countdown} ${expired ? styles.countdownExpired : ''}`}
              role={expired ? 'status' : 'timer'}
            >
              <span className={styles.countdownLabel}>
                {expired ? 'Хугацаа дуссан' : 'Тоглолт эхлэх хугацаа'}
              </span>
              <span className={styles.countdownValue}>
                {remaining === null ? '--:--' : expired ? '00:00' : formatCountdown(remaining)}
              </span>
            </div>
          )}
          {expired && (
            <p className={styles.expiredNote}>
              Зохион байгуулагч руу хандаж шинэчилүүлнэ үү.
            </p>
          )}

          <div className={styles.campNote}>
            <b>Анхаарах нөхцөл</b>
            <ul>
              <li>Зурган дээрх талд таны баг байрлана.</li>
              <li>Тоглолт 5 минут дотор эхлэх ёстой.</li>
              <li>Inspector-т хүн орохыг хориглоно.</li>
              <li>Match leader бол Inspector-т орсон хүнийг Kick хийнэ.</li>
            </ul>
          </div>
        </div>

        <div className={styles.actions}>
          <a
            ref={actionRef}
            className="btn btn-primary"
            href={lobbyUrl}
            target="_blank"
            rel="noreferrer"
          >
            Лобби руу орох
          </a>
          <button type="button" className="btn btn-outline" onClick={copyLink}>
            {copied ? '✓ Хуулагдлаа' : 'Холбоос хуулах'}
          </button>
        </div>
      </div>
    </div>
  );
}
