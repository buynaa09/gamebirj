import { useEffect, useRef, useState } from 'react';
import { cancelQPayPayment, fetchPaymentStatus } from '../../services/payments';
import type { QPayPayment } from '../../types';
import { formatPrice } from '../../utils/format';
import styles from './QPayCheckoutModal.module.css';

const POLL_INTERVAL_MS = 4000;

function qrImageSrc(raw: string): string | null {
  if (!raw) return null;
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
}

function BankLogo({ name, logo }: { name: string; logo: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span className={styles.bankFallback} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={logo}
      alt=""
      loading="lazy"
      className={styles.bankLogo}
      onError={() => setFailed(true)}
    />
  );
}

interface QPayCheckoutModalProps {
  payment: QPayPayment;
  onClose: () => void;
  onPaid: (payment: QPayPayment) => void;
}

export function QPayCheckoutModal({ payment, onClose, onPaid }: QPayCheckoutModalProps) {
  const [current, setCurrent] = useState<QPayPayment>(payment);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (current.status === 'paid' && !notifiedRef.current) {
      notifiedRef.current = true;
      onPaid(current);
    }
  }, [current, onPaid]);

  useEffect(() => {
    if (current.status !== 'pending') return;
    let cancelled = false;
    const poll = () => {
      fetchPaymentStatus(current.id).then(
        (updated) => {
          if (!cancelled) setCurrent(updated);
        },
        () => {
          // Transient check failure — keep polling, surface nothing yet.
        },
      );
    };
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [current.id, current.status]);

  const refresh = () => {
    setError(null);
    setChecking(true);
    fetchPaymentStatus(current.id).then(
      (updated) => {
        setChecking(false);
        setCurrent(updated);
      },
      (err: unknown) => {
        setChecking(false);
        setError(err instanceof Error ? err.message : 'Төлбөр шалгаж чадсангүй.');
      },
    );
  };

  const cancel = () => {
    setError(null);
    setCancelling(true);
    cancelQPayPayment(current.id).then(onClose, (err: unknown) => {
      setCancelling(false);
      setError(err instanceof Error ? err.message : 'Төлбөр цуцалж чадсангүй.');
    });
  };

  const qrSrc = qrImageSrc(current.qpay_qr_image);
  const terminal = current.status !== 'pending';
  const busy = checking || cancelling;

  return (
    <section className={styles.card} aria-label="QPay төлбөр">
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        disabled={busy}
        aria-label="Хаах"
      >
        ✕
      </button>
        <div className={styles.brand}>
          <span className={styles.brandMark}>Q</span>
          <span className={styles.brandName}>QPay</span>
        </div>
        <p className={styles.amount}>{formatPrice(current.amount)}</p>
        {current.status === 'pending' && (
          <p className={styles.sub}>
            Банкны аппаа нээж QR уншуулах эсвэл доорх банкуудын аль нэгийг сонгоно уу.
          </p>
        )}
        {current.status === 'paid' && (
          <p className={styles.success} role="status">
            ✓ Төлбөр баталгаажлаа!
          </p>
        )}
        {(current.status === 'failed' || current.status === 'expired') && (
          <p className={styles.error} role="alert">
            Төлбөр амжилтгүй боллоо. Тусламж хэрэгтэй бол бидэнтэй холбогдоно уу.
          </p>
        )}
        {current.status === 'cancelled' && (
          <p className={styles.error} role="alert">
            Төлбөр цуцлагдсан.
          </p>
        )}

        {!terminal && showQr && qrSrc && (
          <img src={qrSrc} alt="QPay QR код" className={styles.qr} width={200} height={200} />
        )}

        {!terminal && current.banks.length > 0 && (
          <div className={styles.bankGrid}>
            {current.banks.map((bank) => (
              <a
                key={bank.link}
                href={bank.link}
                className={styles.bankBtn}
                title={bank.description || bank.name}
              >
                <BankLogo name={bank.name} logo={bank.logo} />
                <span className={styles.bankName}>{bank.name}</span>
              </a>
            ))}
          </div>
        )}

        {!terminal && current.qpay_short_url && (
          <a
            href={current.qpay_short_url}
            target="_blank"
            rel="noreferrer"
            className={styles.shortLink}
          >
            QPay холбоосоор нээх ↗
          </a>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!terminal && qrSrc && (
          <button
            type="button"
            className={`btn btn-outline ${styles.qrToggle}`}
            onClick={() => setShowQr((v) => !v)}
          >
            {showQr ? 'QR нуух' : 'QR гаргах'}
          </button>
        )}

        {!terminal && (
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={cancel}
              disabled={busy}
            >
              {cancelling ? 'Цуцалж байна…' : 'Болих'}
            </button>
            <button
              type="button"
              className={`btn btn-primary ${styles.payBtn}`}
              onClick={refresh}
              disabled={busy}
            >
              {checking ? 'Шалгаж байна…' : 'Төлбөр шалгах'}
            </button>
          </div>
        )}
        {terminal && current.status !== 'paid' && (
          <div className={styles.actions}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Хаах
            </button>
          </div>
        )}
    </section>
  );
}
