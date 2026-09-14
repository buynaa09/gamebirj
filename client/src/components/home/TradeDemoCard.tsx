import { useEffect, useState } from 'react';
import styles from './TradeDemoCard.module.css';

// Must stay in sync with the `fillBar` animation duration in TradeDemoCard.module.css.
const STAGE_MS = 2400;

const BOXES = [
  { label: 'ХУДАЛДАН АВАГЧ', sub: 'QR / БАНК' },
  { label: 'ASCEND', sub: 'ДУНДЫН ХАМГААЛАЛТ' },
  { label: 'БОРОЛЖУУЛАГЧ', sub: 'ТӨЛБӨР АВАХ' },
];

const STAGES = [
  { status: 'ТӨЛБӨР ТӨЛӨГДСӨН · БАТАЛГААЖСАН', chip: '18,900₮ · Худалдан авагч' },
  { status: 'ДУНДЫН ДАНСАНД ТҮГЖИГДСЭН · ШАЛГАЖ БАЙНА', chip: '18,900₮ · Дундын данс' },
  { status: 'ШИЛЖҮҮЛЭГ ХИЙГДСЭН · АМЖИЛТТАЙ', chip: '18,900₮ · Борлуулагч' },
];

const TIMELINE = [
  { t: 'T+0s', text: 'Худалдан авагч төлбөрөө төлнө. Мөнгө шууд борлуулагч руу шилжихгүй.' },
  { t: 'T+2s', text: 'Худалдан авагч акаунтаа шалгах хооронд мөнгө дундын дансанд аюулгүй хадгалагдана.' },
  { t: 'T+3m', text: 'Акаунт зөв болох нь баталгаажсаны дараа борлуулагч руу төлбөр шилжинэ.' },
];

export function TradeDemoCard() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, STAGE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.tradeCard}>
      <div className={styles.tradeCardTop}>
        <span className={styles.eyebrow}>Арилжаа хэрхэн явагддаг вэ?</span>
        <span className={styles.badge}>Демо</span>
      </div>

      <div className={styles.progress} aria-hidden="true">
        <span key={stage} />
      </div>

      <div className={styles.priceRow}>
        <span className={styles.cur}>₮</span>
        <span className={styles.amt}>18,900</span>
      </div>
      <div className={styles.statusLine}>
        <span key={stage} className={styles.statusSwap}>
          {STAGES[stage].status}
        </span>
      </div>

      <div className={styles.flowRow}>
        {BOXES.map((box, i) => (
          <div key={box.label} className={`${styles.flowBox} ${i === stage ? styles.active : ''}`}>
            <div className={styles.label}>{box.label}</div>
            <div className={styles.sub}>{box.sub}</div>
            <div className={styles.flowFill} />
          </div>
        ))}
      </div>

      <div className={styles.flowChip}>
        <span className={styles.sq} />
        <span key={stage} className={styles.chipSwap}>
          {STAGES[stage].chip}
        </span>
      </div>

      <div className={styles.timeline}>
        {TIMELINE.map((row, i) => (
          <div
            key={row.t}
            className={`${styles.row} ${i === stage ? styles.current : i < stage ? styles.done : ''}`}
          >
            <span className={styles.t}>{row.t}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}