import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import type { MarketAccount } from '../../types';
import { formatPrice, timeAgo } from '../../utils/format';
import styles from './ListingCard.module.css';

const CARD_COLORS = ['#e5344a', '#3a6ee5', '#33a17a', '#c78b1f', '#8b5ce5'];

interface ListingCardProps {
  listing: MarketAccount;
  index: number;
}

export function ListingCard({ listing, index }: ListingCardProps) {
  const navigate = useNavigate();
  const { ids, toggle } = useWishlist();
  const saved = ids.has(listing.id);
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const cover = listing.images.find((img) => img.image)?.image ?? null;
  const sellerInitial = listing.seller.charAt(0).toUpperCase() || '?';

  return (
    <article className={styles.card} onClick={() => navigate(`/listing/${listing.id}`)}>
      <div
        className={styles.cardMedia}
        style={cover ? undefined : { background: `linear-gradient(135deg, ${color}22, ${color}44)` }}
      >
        {cover && <img src={cover} alt="" className={styles.cover} loading="lazy" />}
        {listing.status === 'sold' && <span className={styles.soldRibbon}>Зарагдсан</span>}
        <button
          className={`${styles.favBtn} ${saved ? styles.favActive : ''}`}
          aria-label={saved ? 'Remove from wishlist' : 'Хадгалах хэсэгт нэмэх'}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation();
            toggle(listing.id);
          }}
        >
          {saved ? '♥' : '♡'}
        </button>
        <div className={styles.gameChip}>
          <span>{listing.game ?? 'Тодорхойгүй тоглоом'}</span>
          {listing.game_rank && <span className={styles.rank}>◆ {listing.game_rank}</span>}
        </div>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{listing.title}</p>
        <div className={styles.cardMeta}>{timeAgo(listing.created_at)}</div>
        <div className={styles.cardFoot}>
          <span className={styles.cardPrice}>{formatPrice(listing.price)}</span>
          <span className={styles.sellerDot}>{sellerInitial}</span>
        </div>
      </div>
    </article>
  );
}