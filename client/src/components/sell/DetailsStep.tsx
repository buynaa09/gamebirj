import type { Highlight } from '../../hooks/useSellDraft';
import styles from './DetailsStep.module.css';

interface DetailsStepProps {
  title: string;
  price: string;
  description: string;
  highlights: Highlight[];
  onChange: (patch: { title?: string; price?: string; description?: string; highlights?: Highlight[] }) => void;
}

export function DetailsStep({ title, price, description, highlights, onChange }: DetailsStepProps) {
  const updateHighlight = (index: number, patch: Partial<Highlight>) => {
    onChange({ highlights: highlights.map((h, i) => (i === index ? { ...h, ...patch } : h)) });
  };

  const addHighlight = () => {
    onChange({ highlights: [...highlights, { field: '', value: '' }] });
  };

  const removeHighlight = (index: number) => {
    onChange({ highlights: highlights.filter((_, i) => i !== index) });
  };

  return (
    <div>
      <h3 className={styles.heading}>Details</h3>
      <p className={styles.lead}>Describe your account. Honest, detailed listings sell faster.</p>

      <div className={styles.field}>
        <label htmlFor="sell-title">Listing title *</label>
        <input
          id="sell-title"
          type="text"
          placeholder="e.g. MLBB Account · 186 Skins · Mythical Honor"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="sell-price">Price (₱) *</label>
        <input
          id="sell-price"
          type="number"
          min={1}
          step="any"
          placeholder="e.g. 5500"
          value={price}
          onChange={(e) => onChange({ price: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="sell-description">Description</label>
        <textarea
          id="sell-description"
          rows={5}
          placeholder="Rank, skins, heroes, payment history — anything a buyer should know."
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className={styles.highlightsHead}>
        <span className={styles.highlightsTitle}>Highlight fields</span>
        <button type="button" className={styles.addBtn} onClick={addHighlight}>
          + Add field
        </button>
      </div>
      {highlights.map((h, i) => (
        <div key={i} className={styles.highlightRow}>
          <input
            type="text"
            placeholder="Field (e.g. Rank)"
            aria-label={`Highlight field name ${i + 1}`}
            value={h.field}
            onChange={(e) => updateHighlight(i, { field: e.target.value })}
          />
          <input
            type="text"
            placeholder="Value (e.g. Mythic)"
            aria-label={`Highlight field value ${i + 1}`}
            value={h.value}
            onChange={(e) => updateHighlight(i, { value: e.target.value })}
          />
          <button type="button" className={styles.removeBtn} aria-label={`Remove highlight ${i + 1}`} onClick={() => removeHighlight(i)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
