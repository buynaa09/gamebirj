import { resolveDetailFields } from '../../data/gameDetails';
import type { SellDraft } from '../../hooks/useSellDraft';
import type { Game } from '../../types';
import type { PreviewImage } from './MediaStep';
import styles from './ReviewStep.module.css';

interface ReviewStepProps {
  draft: SellDraft;
  images: PreviewImage[];
  game: Game | null;
}

export function ReviewStep({ draft, images, game }: ReviewStepProps) {
  const filledDetails = resolveDetailFields(game).filter(
    (f) => (draft.detailValues[f.key] ?? '').trim() !== '',
  );
  return (
    <div>
      <h3 className={styles.heading}>Review</h3>
      <p className={styles.lead}>Check everything before publishing. You can go back to edit any step.</p>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Game</dt>
          <dd className={styles.gameCell}>
            {game?.image && <img src={game.image} alt="" className={styles.gameThumb} />}
            {draft.gameName}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Title</dt>
          <dd>{draft.listingTitle.trim() !== '' ? draft.listingTitle : draft.rank || '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Rank / Level</dt>
          <dd>{draft.rank || '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Price</dt>
          <dd className={styles.price}>
            ₱{draft.price || '—'}
            <span className={styles.firm}>{draft.acceptOffers ? ' · open to offers' : ' · firm'}</span>
          </dd>
        </div>
        {filledDetails.length > 0 && (
          <div className={styles.row}>
            <dt>Details</dt>
            <dd>
              <ul className={styles.highlights}>
                {filledDetails.map((f) => (
                  <li key={f.key}>
                    <b>{f.label}</b>: {draft.detailValues[f.key]}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {draft.description.trim() !== '' && (
          <div className={styles.row}>
            <dt>Description</dt>
            <dd className={styles.clamp}>{draft.description}</dd>
          </div>
        )}
        <div className={styles.row}>
          <dt>Photos</dt>
          <dd>
            {images.length === 0 ? (
              '—'
            ) : (
              <div className={styles.photoStrip}>
                {images.map((img, i) => (
                  <img key={`${img.name}-${i}`} src={img.url} alt={`Screenshot ${i + 1}`} className={styles.photo} />
                ))}
              </div>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
