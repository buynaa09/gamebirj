import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>GameBirj</span>
          <span className={styles.tagline}>Gaming account marketplace</span>
        </div>
        <nav className={styles.links} aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/rent">Rentals</Link>
          <Link to="/tournaments">Тэмцээн</Link>
          <Link to="/sell">Sell</Link>
          <Link to="/facebook-policy">Privacy Policy</Link>
        </nav>
        <p className={styles.copy}>
          &copy; {year} GameBirj &middot;{' '}
          <a href="https://gamebirj.com/">gamebirj.com</a>
        </p>
      </div>
    </footer>
  );
}
