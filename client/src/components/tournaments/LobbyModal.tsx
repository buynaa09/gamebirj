import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import camp1Image from '../../assets/tournaments/left.jpeg';
import camp2Image from '../../assets/tournaments/right.jpeg';
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
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    const update = () => setRemaining(Number.isNaN(target) ? null : Math.ceil((target - Date.now()) / 1000));
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

        {camp === 1 || camp === 2 ? (
          <img
            className={styles.campImage}
            src={camp === 1 ? camp1Image : camp2Image}
            alt={camp === 1 ? 'Таны баг camp 1' : 'Таны баг camp 2'}
          />
        ) : (
          <div className={styles.qrWrap}>
            <QRCode value={lobbyUrl} size={180} aria-label="Лобби QR код" />
          </div>
        )}
        <div className={styles.campNote}>
          <b>Анхаарах нөхцөл</b>
          <ul>
            <li>Энэ зураг дээрх талд танай баг байрлана.</li>
             <li>Тоглолт 5 минут дотор эхлэх ёстой</li>
            <li>Inspector-т хүн орохыг хориглоно. </li>
            <li>Та match leader бол Inspector-т орсон хүнийг Kick хийнэ.</li>
          </ul>
        </div>
        <div className={styles.countdown}>
         
          <span>{remaining === null ? 'Цагийг тооцоолж байна…' : remaining > 0 ? formatCountdown(remaining) : 'Тоглолт эхлэх цаг дуссан'}</span>
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
