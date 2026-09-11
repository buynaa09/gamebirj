import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGames } from '../hooks/useGames';
import { useSellDraft } from '../hooks/useSellDraft';
import { StepIndicator } from '../components/sell/StepIndicator';
import { GameStep } from '../components/sell/GameStep';
import { DetailsStep } from '../components/sell/DetailsStep';
import { MediaStep } from '../components/sell/MediaStep';
import type { PreviewImage } from '../components/sell/MediaStep';
import { ReviewStep } from '../components/sell/ReviewStep';
import styles from './SellPage.module.css';

export function SellPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const games = useGames();
  const { draft, update, reset, restored } = useSellDraft();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const validate = (s: number): string | null => {
    if (s === 0 && !draft.gameName) return 'Please choose a game to continue.';
    if (s === 1 && (draft.price.trim() === '' || Number(draft.price) <= 0)) {
      return 'Please enter a valid price.';
    }
    if (s === 2 && images.length === 0) return 'Please add at least one screenshot.';
    return null;
  };

  const goNext = () => {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const publish = () => {
    for (let s = 0; s <= 2; s++) {
      const problem = validate(s);
      if (problem) {
        setError(problem);
        setStep(s);
        return;
      }
    }
    setError(null);
    setPublished(true);
    reset();
  };

  const discardDraft = () => {
    reset();
    setStep(0);
    setImages([]);
    setError(null);
  };

  if (published) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successBadge}>✓</div>
          <h1 className={styles.title}>Зар нийтлэгдлээ</h1>
          <p className={styles.subtitle}>
            Таны аккаунт зах зээл дээр байршлаа. Худалдан авагчийн төлбөр Солилцоо эскроу системд хадгалагдах бөгөөд шилжүүлэг баталгаажсаны дараа та мөнгөө авах болно.
          </p>
          <p className={styles.demoNote}>Демо — одоогоор сервертэй холбогдоогүй байна.</p>
          <div className={styles.successActions}>
            <button className="btn btn-primary" onClick={() => navigate('/marketplace')}>
              Зах зээлийг үзэх
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setPublished(false);
                setStep(0);
                setImages([]);
              }}
            >
              Дахин зар оруулах
            </button>
          </div>
        </div>
      </main>
    );
  }

  const gameImage = games.find((g) => g.name === draft.gameName)?.image ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/">Нүүр</Link> &nbsp;›&nbsp; <span className={styles.cur}>Зарах</span>
      </div>

      <h1 className={styles.title}>Аккаунт зарах</h1>
      <p className={styles.subtitle}>Солилцоо платформд тоглоомын аккаунтоо байршуулаарай.</p>

      {restored && (
        <div className={styles.draftBanner}>
          <span>Сүүлд үлдээсэн сэргээгдсэн ноорог байна.</span>
          <button type="button" className={styles.draftDiscard} onClick={discardDraft}>
            Нооргийг устгах
          </button>
        </div>
      )}

      <div className={styles.payoutBanner}>
        <span className={styles.payoutIcon} aria-hidden="true">
          ⚠
        </span>
        <div>
          <b>Анхны борлуулалтаа хийхээс өмнө дансны мэдээллээ оруулна уу</b>
          <p>Та яг одоо зараа байршуулах боломжтой — зөвхөн орлогоо татан авахаас өмнө тохируулахад хангалттай.</p>
          <a href="#" className={styles.payoutLink}>
            Борлуулагчийн хянах бар руу очих →
          </a>
        </div>
      </div>

      <StepIndicator current={step} />

      <div className={styles.card}>
        {step === 0 && <GameStep selected={draft.gameName} onSelect={(gameName) => update({ gameName })} />}
        {step === 1 && (
          <DetailsStep gameName={draft.gameName} gameImage={gameImage} draft={draft} onChange={update} />
        )}
        {step === 2 && <MediaStep images={images} onChange={setImages} />}
        {step === 3 && <ReviewStep draft={draft} images={images} gameImage={gameImage} />}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.navRow}>
          {step > 0 ? (
            <button type="button" className="btn btn-outline" onClick={goBack}>
              ← Буцах
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Үргэлжлүүлэх →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={publish}>
              Зар нийтлэх
            </button>
          )}
        </div>
      </div>
    </main>
  );
}