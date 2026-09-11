import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon } from '../icons/Icons';
import { TradeDemoCard } from './TradeDemoCard';
import styles from './Hero.module.css';

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div>
          <h1>
            Buy, sell &amp; exchange gaming<br />
            accounts, <em>safely.</em>
          </h1>
          <p className={styles.lead}>
      Soliltsoo — тоглоомын аккаунт худалдах, худалдан авах найдвартай marketplace.
🛡️Midman Escrow: Худалдан авагчийн мөнгийг Soliltsoo хүлээн авч, account-ыг баталгаажуулах хүртэл найдвартай хадгална. Амжилттай баталгаажсаны дараа мөнгө худалдагчид шилжинэ.
          </p>
          <div className={styles.heroCtas}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/sell')}
            >
              Account зарах
              <ArrowRightIcon />
            </button>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/marketplace')}
            >
              Аccount худалдаж авах
            </button>
          </div>
          <a href="#" className={styles.linkArrow}>
             Хэрхэн mid ажилладаг
            <ArrowRightIcon size={13} />
          </a>
        </div>

        <TradeDemoCard />
      </div>
    </section>
  );
}
