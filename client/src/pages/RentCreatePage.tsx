import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useGames } from '../hooks/useGames';
import { useRentDraft } from '../hooks/useRentDraft';
import { publishListing } from '../services/accounts';
import { StepIndicator } from '../components/sell/StepIndicator';
import { GameStep } from '../components/sell/GameStep';
import { DetailsStep } from '../components/sell/DetailsStep';
import { MediaStep } from '../components/sell/MediaStep';
import type { PreviewImage } from '../components/sell/MediaStep';
import { ReviewStep } from '../components/sell/ReviewStep';
import type { CreatedAccount, RentalUnit } from '../types';
import styles from './SellPage.module.css';

const RENTAL_UNITS: { value: RentalUnit; label: string }[] = [
  { value: 'hour', label: 'Цаг (₮/цаг)' },
  { value: 'day', label: 'Өдөр (₮/өдөр)' },
  { value: 'month', label: 'Сар (₮/сар)' },
];

export function RentCreatePage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const games = useGames();
  const { draft, update, reset, restored } = useRentDraft();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<CreatedAccount | null>(null);

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

  // Detail values are keyed by listing id, which differs per game — keeping
  // the old game's values would submit foreign ids and the API rejects them
  // ("Listing X does not apply to ..."). Rank ladders differ per game too.
  const selectGame = (gameName: string) => {
    if (gameName !== draft.gameName) {
      update({ gameName, rank: '', detailValues: {} });
    } else {
      update({ gameName });
    }
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
    const game = games.find((g) => g.name === draft.gameName) ?? null;
    if (!game || game.id < 0) {
      setError('Сервертэй холбогдож чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.');
      return;
    }
    const validListingIds = new Set(game.listings.map((l) => l.id));
    const details = Object.entries(draft.detailValues)
      .filter(([, value]) => value.trim() !== '')
      .map(([key, value]) => ({ listing: Number(key.replace('listing:', '')), value: value.trim() }))
      // Drop stale ids (e.g. a draft saved before switching games or against
      // an older DB seed) — the API only accepts this game's listings.
      .filter((d) => Number.isFinite(d.listing) && validListingIds.has(d.listing));
    setError(null);
    setPublishing(true);
    publishListing({
      gameId: game.id,
      rank: draft.rank.trim(),
      title: draft.listingTitle.trim(),
      price: draft.price.trim(),
      description: draft.description,
      acceptOffers: draft.acceptOffers,
      details,
      images: images.map((img) => img.file),
      kind: 'rent',
      rentalUnit: draft.rentalUnit,
    })
      .then((account) => {
        setPublished(account);
        reset();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Нийтлэх үед алдаа гарлаа.');
      })
      .finally(() => {
        setPublishing(false);
      });
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
          <h1 className={styles.title}>Түрээс нийтлэгдлээ</h1>
          <p className={styles.subtitle}>
            «{published.title}» түрээсийн зах зээл дээр байршлаа. Түрээслэгчийн төлбөр
            Солилцоо эскроу системд хадгалагдаж, түрээс дуусахад аккаунтыг буцааж авна.
          </p>
          <div className={styles.successActions}>
            <button className="btn btn-primary" onClick={() => navigate('/rent')}>
              Түрээсийг үзэх
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setPublished(null);
                setStep(0);
                setImages([]);
              }}
            >
              Дахин түрээс оруулах
            </button>
          </div>
        </div>
      </main>
    );
  }

  const game = games.find((g) => g.name === draft.gameName) ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/">Нүүр</Link> &nbsp;›&nbsp; <Link to="/rent">Түрээс</Link> &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>Түрээслүүлэх</span>
      </div>

      <h1 className={styles.title}>Аккаунт түрээслүүлэх</h1>

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
          <b>Анхны түрээсээ хийхээс өмнө дансны мэдээллээ оруулна уу</b>
          <p>Та яг одоо түрээсээ байршуулах боломжтой — зөвхөн орлогоо татан авахаас өмнө тохируулахад хангалттай.</p>
          <a href="#" className={styles.payoutLink}>
            Борлуулагчийн хянах бар руу очих →
          </a>
        </div>
      </div>

      <StepIndicator current={step} />

      <div className={styles.card}>
        {step === 0 && <GameStep selected={draft.gameName} onSelect={selectGame} />}
        {step === 1 && (
          <>
            <label className={styles.unitRow} htmlFor="rent-unit">
              Түрээсийн нэгж *
              <select
                id="rent-unit"
                value={draft.rentalUnit}
                onChange={(e) => update({ rentalUnit: e.target.value as RentalUnit })}
              >
                {RENTAL_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <DetailsStep game={game} draft={draft} onChange={update} />
          </>
        )}
        {step === 2 && <MediaStep images={images} onChange={setImages} />}
        {step === 3 && <ReviewStep draft={draft} images={images} game={game} />}

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
            <button type="button" className="btn btn-primary" onClick={publish} disabled={publishing}>
              {publishing ? 'Нийтэлж байна…' : 'Түрээс нийтлэх'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
