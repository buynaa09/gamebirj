import { formatPrice, offerCountdown } from '../../utils/format';
import type { Offer } from '../../types';
import styles from './OfferCard.module.css';

interface OfferCardProps {
  offer: Offer;
  /** True when the viewer sent the offer. */
  isOwn: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}

function statusLine(offer: Offer): string {
  switch (offer.status) {
    case 'accepted':
      return '✓ Зөвшөөрсөн • үнэ 24 цаг хүчинтэй';
    case 'declined':
      return 'Татгалзсан';
    case 'expired':
      return 'Хугацаа дууссан';
    case 'cancelled':
      return 'Цуцалсан';
    default:
      return offerCountdown(offer.expires_at);
  }
}

export function OfferCard({ offer, isOwn, busy, onAccept, onDecline, onCancel }: OfferCardProps) {
  const active = offer.status === 'pending' && offerCountdown(offer.expires_at) !== 'Хугацаа дууссан';

  const tone =
    offer.status === 'accepted'
      ? styles.accepted
      : offer.status === 'pending'
        ? styles.pending
        : styles.closed;

  return (
    <div className={`${styles.card} ${tone}`}>
      <p className={styles.kicker}>{isOwn ? 'Таны санал' : 'Үнийн санал'}</p>
      <p className={styles.amount}>💰 {formatPrice(offer.amount)}</p>
      <p className={styles.status}>{statusLine(offer)}</p>
      {active && !isOwn && (
        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-primary ${styles.accept}`}
            onClick={onAccept}
            disabled={busy}
          >
            Зөвшөөрөх
          </button>
          <button type="button" className="btn btn-outline" onClick={onDecline} disabled={busy}>
            Татгалзах
          </button>
        </div>
      )}
      {active && isOwn && (
        <div className={styles.actions}>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
            Цуцлах
          </button>
        </div>
      )}
    </div>
  );
}
