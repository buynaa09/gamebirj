import { Link, useNavigate } from 'react-router-dom';
import styles from './MarketplaceHeader.module.css';

export function MarketplaceHeader() {
  const navigate = useNavigate();
  return (
    <div className={styles.header}>
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>Marketplace</span>
      </div>
      <div className={styles.titleRow}>
        <div>
          <div className={styles.eyebrowRed}>Mongolian marketplace</div>
          <h2>Борлуулалт,Худалдан авалт бүр 100% аюулгүй</h2>
          <p>
            Таны төлбөрийг худалдагчид шууд шилжүүлэхгүй бөгөөд 
            Soliltsoo system дээр найдвартай хадгалагдана.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-outline">Зөвлөгөө</button>
          <button className="btn btn-primary" onClick={() => navigate('/sell/processing')}>+ Account зарах</button>
        </div>
      </div>
    </div>
  );
}
