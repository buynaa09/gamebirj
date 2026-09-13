import { Link, useNavigate } from 'react-router-dom';
import styles from './MarketplaceHeader.module.css';

export function RentalHeader() {
  const navigate = useNavigate();
  return (
    <div className={styles.header}>
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp; <span className={styles.cur}>Түрээс</span>
      </div>
      <div className={styles.titleRow}>
        <div>
          <div className={styles.eyebrowRed}>Mongolian marketplace</div>
          <h2>Аккаунт түрээслэх бүр 100% аюулгүй</h2>
          <p>
            Таны төлбөрийг түрээслүүлэгчид шууд шилжүүлэхгүй бөгөөд GameBirj system
            дээр найдвартай хадгалагдана. Түрээс дуусахад аккаунтыг буцааж хүлээлгэн өгнө.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-outline">Зөвлөгөө</button>
          <button className="btn btn-primary" onClick={() => navigate('/rent/create')}>
            + Account түрээслүүлэх
          </button>
        </div>
      </div>
    </div>
  );
}
