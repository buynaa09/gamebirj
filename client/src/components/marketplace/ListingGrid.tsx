import type { Listing } from '../../types';
import { ListingCard } from './ListingCard';
import styles from './ListingGrid.module.css';

interface ListingGridProps {
  listings: Listing[];
}

export function ListingGrid({ listings }: ListingGridProps) {
  return (
    <div className={styles.grid}>
      {listings.map((listing, i) => (
        <ListingCard key={listing.id} listing={listing} index={i} />
      ))}
    </div>
  );
}
