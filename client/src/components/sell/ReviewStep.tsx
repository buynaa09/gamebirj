import type { SellDraft } from '../../hooks/useSellDraft';
import type { PreviewImage } from './MediaStep';
import styles from './ReviewStep.module.css';

interface ReviewStepProps {
  draft: SellDraft;
  images: PreviewImage[];
  gameImage: string | null;
}

const DELIVERY_LABELS = {
  manual: 'Manual handover',
  instant: 'Instant delivery',
} as const;

export function ReviewStep({ draft, images, gameImage }: ReviewStepProps) {
  return (
    <div>
      <h3 className={styles.heading}>Review</h3>
      <p className={styles.lead}>Check everything before publishing. You can go back to edit any step.</p>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Game</dt>
          <dd className={styles.gameCell}>
            {gameImage && <img src={gameImage} alt="" className={styles.gameThumb} />}
            {draft.gameName}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Delivery</dt>
          <dd>{draft.delivery ? DELIVERY_LABELS[draft.delivery] : '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Title</dt>
          <dd>{draft.title || '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Price</dt>
          <dd className={styles.price}>₱{draft.price || '—'}</dd>
        </div>
        {draft.description.trim() !== '' && (
          <div className={styles.row}>
            <dt>Description</dt>
            <dd className={styles.clamp}>{draft.description}</dd>
          </div>
        )}
        {draft.highlights.filter((h) => h.field.trim() !== '' || h.value.trim() !== '').length > 0 && (
          <div className={styles.row}>
            <dt>Highlights</dt>
            <dd>
              <ul className={styles.highlights}>
                {draft.highlights
                  .filter((h) => h.field.trim() !== '' || h.value.trim() !== '')
                  .map((h, i) => (
                    <li key={i}>
                      <b>{h.field || '—'}</b>: {h.value || '—'}
                    </li>
                  ))}
              </ul>
            </dd>
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
