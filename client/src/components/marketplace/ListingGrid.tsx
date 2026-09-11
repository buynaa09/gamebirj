import type { MarketAccount } from '../../types';
import { ListingCard } from './ListingCard';
import styles from './ListingGrid.module.css';

interface ListingGridProps {
  listings: MarketAccount[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ListingGrid({ listings, loading, error, onRetry }: ListingGridProps) {
  if (loading) {
    return <p className={styles.state}>Loading listings…</p>;
  }
  if (error) {
    return (
      <p className={styles.state}>
        Couldn't load listings ({error}).{' '}
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }
  if (listings.length === 0) {
    return <p className={styles.state}>No listings yet — be the first to sell an account.</p>;
  }
  return (
    <div className={styles.grid}>
      {listings.map((listing, i) => (
        <ListingCard key={listing.id} listing={listing} index={i} />
      ))}
    </div>
  );
}
