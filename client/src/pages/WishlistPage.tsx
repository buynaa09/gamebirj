import { Link } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useWishlist } from '../context/WishlistContext';
import { ListingGrid } from '../components/marketplace/ListingGrid';
import styles from './WishlistPage.module.css';

export function WishlistPage() {
  const { accounts, loading, error, reload } = useAccounts();
  const { ids } = useWishlist();
  const saved = accounts.filter((a) => ids.has(a.id));

  return (
    <main className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp; <span className={styles.cur}>Wishlist</span>
      </div>
      <h1 className={styles.title}>Wishlist</h1>
      <p className={styles.subtitle}>
        {saved.length === 0 && !loading
          ? 'Tap the heart on any listing to save it here.'
          : `${saved.length} saved listing${saved.length === 1 ? '' : 's'}`}
      </p>
      {saved.length === 0 && !loading && !error ? (
        <p className={styles.empty}>Browse the marketplace and tap ♡ on anything you like.</p>
      ) : (
        <ListingGrid listings={saved} loading={loading} error={error} onRetry={reload} />
      )}
    </main>
  );
}
