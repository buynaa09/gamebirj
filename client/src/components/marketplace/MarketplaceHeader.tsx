import { Link } from 'react-router-dom';
import styles from './MarketplaceHeader.module.css';

export function MarketplaceHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>Marketplace</span>
      </div>
      <div className={styles.titleRow}>
        <div>
          <div className={styles.eyebrowRed}>Worldwide marketplace</div>
          <h2>Gaming accounts for sale, every purchase escrow-protected</h2>
          <p>
            18 live listings across 40+ games. Your payment is held by ASCEND,
            never sent straight to the seller.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-outline">Buyer guide</button>
          <button className="btn btn-primary">+ Sell account</button>
        </div>
      </div>
    </div>
  );
}
