import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGames } from '../hooks/useGames';
import { useSellDraft } from '../hooks/useSellDraft';
import { StepIndicator } from '../components/sell/StepIndicator';
import { GameStep } from '../components/sell/GameStep';
import { DeliveryStep } from '../components/sell/DeliveryStep';
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
    if (s === 1 && !draft.delivery) return 'Please choose a delivery method to continue.';
    if (s === 2) {
      if (draft.title.trim() === '') return 'Please add a listing title.';
      if (draft.price.trim() === '' || Number(draft.price) <= 0) return 'Please enter a valid price.';
    }
    if (s === 3 && images.length === 0) return 'Please add at least one screenshot.';
    return null;
  };

  const goNext = () => {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const publish = () => {
    for (let s = 0; s <= 3; s++) {
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
          <h1 className={styles.title}>Listing published</h1>
          <p className={styles.subtitle}>
            Your account is now live on the marketplace. Buyers pay into Midman escrow, and you get paid once delivery
            is confirmed.
          </p>
          <p className={styles.demoNote}>Demo — publishing is not wired to the backend yet.</p>
          <div className={styles.successActions}>
            <button className="btn btn-primary" onClick={() => navigate('/marketplace')}>
              View marketplace
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setPublished(false);
                setStep(0);
                setImages([]);
              }}
            >
              Sell another
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
        <Link to="/">Home</Link> &nbsp;›&nbsp; <span className={styles.cur}>Sell</span>
      </div>

      <h1 className={styles.title}>Sell an Account</h1>
      <p className={styles.subtitle}>List your gaming account on the Soliltsoo marketplace</p>

      {restored && (
        <div className={styles.draftBanner}>
          <span>Draft restored from your last session.</span>
          <button type="button" className={styles.draftDiscard} onClick={discardDraft}>
            Discard draft
          </button>
        </div>
      )}

      <div className={styles.payoutBanner}>
        <span className={styles.payoutIcon} aria-hidden="true">
          ⚠
        </span>
        <div>
          <b>Add a payout method before your first sale</b>
          <p>You can list right now — this only needs to be set before we can send your earnings.</p>
          <a href="#" className={styles.payoutLink}>
            Go to Seller Dashboard →
          </a>
        </div>
      </div>

      <StepIndicator current={step} />

      <div className={styles.card}>
        {step === 0 && <GameStep selected={draft.gameName} onSelect={(gameName) => update({ gameName })} />}
        {step === 1 && <DeliveryStep value={draft.delivery} onChange={(delivery) => update({ delivery })} />}
        {step === 2 && (
          <DetailsStep
            title={draft.title}
            price={draft.price}
            description={draft.description}
            highlights={draft.highlights}
            onChange={update}
          />
        )}
        {step === 3 && <MediaStep images={images} onChange={setImages} />}
        {step === 4 && <ReviewStep draft={draft} images={images} gameImage={gameImage} />}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.navRow}>
          {step > 0 ? (
            <button type="button" className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Next →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={publish}>
              Publish listing
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
