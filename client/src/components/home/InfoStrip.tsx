import styles from './InfoStrip.module.css';

const items = [
  '40+ games supported',
  'Free to list an account',
  'KYC-verified seller badge',
  'Escrow held until delivery is confirmed',
];

export function InfoStrip() {
  return (
    <div className={styles.strip}>
      {items.map(item => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
