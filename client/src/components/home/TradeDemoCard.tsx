import styles from './TradeDemoCard.module.css';

export function TradeDemoCard() {
  return (
    <div className={styles.tradeCard}>
      <div className={styles.tradeCardTop}>
        <span className={styles.eyebrow}>How a trade works</span>
        <span className={styles.badge}>Demo · not a real trade</span>
      </div>

      <div className={styles.priceRow}>
        <span className={styles.cur}>PHP</span>
        <span className={styles.amt}>18,900</span>
      </div>
      <div className={styles.statusLine}>BUYER PAID · CAPTURED</div>

      <div className={styles.flowRow}>
        <div className={`${styles.flowBox} ${styles.active}`}>
          <div className={styles.label}>BUYER</div>
          <div className={styles.sub}>QR PH / BANK</div>
          <div className={styles.flowFill} />
        </div>
        <div className={styles.flowBox}>
          <div className={styles.label}>ASCEND</div>
          <div className={styles.sub}>MIDMAN VAULT</div>
        </div>
        <div className={styles.flowBox}>
          <div className={styles.label}>SELLER</div>
          <div className={styles.sub}>PAYOUT</div>
        </div>
      </div>

      <div className={styles.flowChip}>
        <span className={styles.sq} /> PHP 18,900
      </div>

      <div className={styles.timeline}>
        <div className={styles.row}>
          <span className={styles.t}>T+0s</span>
          <span>Buyer paid. Money leaves the buyer, not into the seller's pocket.</span>
        </div>
        <div className={styles.row}>
          <span className={styles.t}>T+2s</span>
          <span>Locked in the vault while the buyer logs in and checks the account.</span>
        </div>
        <div className={styles.row}>
          <span className={styles.t}>T+3m</span>
          <span>Once confirmed, the vault releases payout to the seller.</span>
        </div>
      </div>
    </div>
  );
}
