import type { Listing } from '../../types';
import { CARD_COLORS } from '../../data/listings';
import styles from './ListingCard.module.css';

interface ListingCardProps {
  listing: Listing;
  index: number;
}

export function ListingCard({ listing, index }: ListingCardProps) {
  const color = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <article className={styles.card}>
      <div
        className={styles.cardMedia}
        style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}
      >
        <div className={styles.tagManual}>🛈 MANUAL</div>
        <button className={styles.favBtn} aria-label="Add to favorites">♡</button>
        <div className={styles.gameChip}>
          <span>{listing.game}</span>
          <span className={styles.rank}>◆ {listing.rank}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{listing.title}</p>
        <div className={styles.cardMeta}>{listing.time}</div>
        <div className={styles.cardFoot}>
          <span className={styles.cardPrice}>{listing.price}</span>
          <span className={styles.sellerDot}>{listing.seller}</span>
        </div>
      </div>
    </article>
  );
}
