import { useRef } from 'react';
import { detailSectionFor, rankOptionsFor } from '../../data/gameDetails';
import { listings } from '../../data/listings';
import type { SellDraft } from '../../hooks/useSellDraft';
import styles from './DetailsStep.module.css';

interface DetailsStepProps {
  gameName: string | null;
  gameImage: string | null;
  draft: SellDraft;
  onChange: (patch: Partial<SellDraft>) => void;
}

const TITLE_LIMIT = 100;
const DESCRIPTION_LIMIT = 2000;

function parsePrice(raw: string): number | null {
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DetailsStep({ gameName, gameImage, draft, onChange }: DetailsStepProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const section = detailSectionFor(gameName);
  const ranks = rankOptionsFor(gameName);

  const marketPrices = listings
    .filter((l) => gameName !== null && l.game === gameName)
    .map((l) => parsePrice(l.price))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const marketMedian = marketPrices.length > 0 ? marketPrices[Math.floor(marketPrices.length / 2)] : null;

  const setDetail = (key: string, value: string) => {
    onChange({ detailValues: { ...draft.detailValues, [key]: value } });
  };

  const applyEdit = (
    fn: (value: string, start: number, end: number) => { value: string; caret: [number, number] },
  ) => {
    const el = areaRef.current;
    if (!el) return;
    undoStack.current.push(draft.description);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    const { value, caret } = fn(draft.description, el.selectionStart, el.selectionEnd);
    onChange({ description: value.slice(0, DESCRIPTION_LIMIT) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret[0], caret[1]);
    });
  };

  const wrap = (before: string, after: string = before) => {
    applyEdit((value, s, e) => {
      const sel = value.slice(s, e) || 'text';
      const next = value.slice(0, s) + before + sel + after + value.slice(e);
      return { value: next, caret: [s + before.length, s + before.length + sel.length] };
    });
  };

  const prefixLines = (prefix: (i: number) => string) => {
    applyEdit((value, s, e) => {
      const start = value.lastIndexOf('\n', s - 1) + 1;
      const end = e === value.length || value[e] === '\n' ? e : value.indexOf('\n', e);
      const block = value.slice(start, end === -1 ? value.length : end);
      const replaced = block
        .split('\n')
        .map((line, i) => `${prefix(i)}${line.replace(/^(\d+\.\s+|-\s+)/, '')}`)
        .join('\n');
      const next = value.slice(0, start) + replaced + value.slice(end === -1 ? value.length : end);
      return { value: next, caret: [start, start + replaced.length] };
    });
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(draft.description);
    onChange({ description: prev });
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(draft.description);
    onChange({ description: next });
  };

  const wordCount = draft.description.trim() === '' ? 0 : draft.description.trim().split(/\s+/).length;

  return (
    <div>
      <h3 className={styles.heading}>Details</h3>
      <p className={styles.lead}>Add account details and pricing</p>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="sell-listing-title">
            Listing Title <span className={styles.optional}>(optional)</span>
          </label>
          <span className={styles.counter}>
            {draft.listingTitle.length}/{TITLE_LIMIT}
          </span>
        </div>
        <input
          id="sell-listing-title"
          type="text"
          placeholder='e.g. "Max Rank Mobile Legends — 200+ Skins"'
          value={draft.listingTitle}
          maxLength={TITLE_LIMIT}
          onChange={(e) => onChange({ listingTitle: e.target.value })}
        />
        <p className={styles.hint}>Give your listing a custom headline. If left blank, the rank will be used.</p>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.field}>
          <label htmlFor="sell-rank">Rank / Level</label>
          <div className={styles.selectWrap}>
            <select id="sell-rank" value={draft.rank} onChange={(e) => onChange({ rank: e.target.value })}>
              <option value="">Select rank</option>
              {ranks.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className={styles.selectChevron} aria-hidden="true">
              ▾
            </span>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="sell-price">Price (₱) *</label>
          <input
            id="sell-price"
            type="number"
            min={1}
            step="any"
            placeholder="0"
            value={draft.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.priceSide}>
        {marketPrices.length > 0 && marketMedian !== null && (
          <p className={styles.marketHint}>
            {marketPrices.length} other {gameName} account{marketPrices.length === 1 ? '' : 's'} listed at{' '}
            {formatPeso(marketPrices[0])}–{formatPeso(marketPrices[marketPrices.length - 1])}, typically{' '}
            {formatPeso(marketMedian)}. These are asking prices, not sold prices — you set yours, and you can change
            it later.
          </p>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={draft.acceptOffers}
          className={styles.offersRow}
          onClick={() => onChange({ acceptOffers: !draft.acceptOffers })}
        >
          <span className={`${styles.switch} ${draft.acceptOffers ? styles.switchOn : ''}`} aria-hidden="true">
            <span className={styles.knob} />
          </span>
          <span className={styles.offersText}>
            <b>Accept offers</b> — buyers can propose a lower price and you accept, decline, or counter. Turn this off
            and your price shows as firm.
          </span>
        </button>
      </div>

      <div className={styles.gamePanel}>
        <div className={styles.gamePanelHead}>
          {gameImage && <img src={gameImage} alt="" className={styles.gamePanelThumb} />}
          <div>
            <div className={styles.gamePanelTitle}>{section.heading}</div>
            <div className={styles.gamePanelSub}>{section.subheading}</div>
          </div>
        </div>
        <div className={styles.gameGrid}>
          {section.fields.map((field) => (
            <div key={field.key} className={styles.field}>
              <label htmlFor={`sell-detail-${field.key}`}>{field.label}</label>
              {field.kind === 'select' ? (
                <div className={styles.selectWrap}>
                  <select
                    id={`sell-detail-${field.key}`}
                    value={draft.detailValues[field.key] ?? ''}
                    onChange={(e) => setDetail(field.key, e.target.value)}
                  >
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {(field.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectChevron} aria-hidden="true">
                    ▾
                  </span>
                </div>
              ) : (
                <input
                  id={`sell-detail-${field.key}`}
                  type={field.kind === 'number' ? 'number' : 'text'}
                  min={field.kind === 'number' ? 0 : undefined}
                  placeholder={field.placeholder}
                  value={draft.detailValues[field.key] ?? ''}
                  onChange={(e) => setDetail(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="sell-description">Description</label>
          <span className={styles.counter}>
            {draft.description.length}/{DESCRIPTION_LIMIT}
          </span>
        </div>
        <div className={styles.toolbar} role="toolbar" aria-label="Description formatting">
          <button type="button" title="Undo" aria-label="Undo" onClick={undo}>
            ↩
          </button>
          <button type="button" title="Redo" aria-label="Redo" onClick={redo}>
            ↪
          </button>
          <button type="button" title="Bold" aria-label="Bold" onClick={() => wrap('**')}>
            <b>B</b>
          </button>
          <button type="button" title="Italic" aria-label="Italic" onClick={() => wrap('*')}>
            <i>I</i>
          </button>
          <button type="button" title="Bullet list" aria-label="Bullet list" onClick={() => prefixLines(() => '- ')}>
            ☰
          </button>
          <button type="button" title="Numbered list" aria-label="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>
            1☰
          </button>
          <button type="button" title="Link" aria-label="Link" onClick={() => wrap('[', '](url)')}>
            🔗
          </button>
          <button
            type="button"
            title="Emoji"
            aria-label="Emoji"
            onClick={() =>
              applyEdit((value, s, e) => {
                const next = `${value.slice(0, s)}🙂${value.slice(e)}`;
                return { value: next, caret: [s + 2, s + 2] };
              })
            }
          >
            🙂
          </button>
        </div>
        <textarea
          ref={areaRef}
          id="sell-description"
          rows={7}
          maxLength={DESCRIPTION_LIMIT}
          placeholder="Describe your account — include notable items, resources, skins, etc."
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <div className={styles.descFoot}>
          <span>{wordCount} words</span>
          <span>
            {draft.description.length}/{DESCRIPTION_LIMIT}
          </span>
        </div>
      </div>
    </div>
  );
}
