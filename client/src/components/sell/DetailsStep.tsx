import { useRef } from 'react';
import { resolveDetailFields, resolveRanks } from '../../data/gameDetails';
import { listings } from '../../data/listings';
import type { SellDraft } from '../../hooks/useSellDraft';
import type { Game } from '../../types';
import styles from './DetailsStep.module.css';

interface DetailsStepProps {
  game: Game | null;
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
  return `₮${n.toLocaleString('mn-MN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function DetailsStep({ game, draft, onChange }: DetailsStepProps) {
  const gameName = game?.name ?? null;
  const gameImage = game?.image ?? null;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const fields = resolveDetailFields(game);
  const ranks = resolveRanks(game);

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
      const sel = value.slice(s, e) || 'текст';
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
      <h3 className={styles.heading}>Дэлгэрэнгүй мэдээлэл</h3>
      <p className={styles.lead}>Аккунтын мэдээлэл болон үнийг оруулна уу</p>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="sell-listing-title">
            Зарын гарчиг <span className={styles.optional}>(заавал биш)</span>
          </label>
          <span className={styles.counter}>
            {draft.listingTitle.length}/{TITLE_LIMIT}
          </span>
        </div>
        <input
          id="sell-listing-title"
          type="text"
          placeholder='Жишээ нь: "Mobile Legends high rank — 200+. Skins, heroes, and more!"'
          value={draft.listingTitle}
          maxLength={TITLE_LIMIT}
          onChange={(e) => onChange({ listingTitle: e.target.value })}
        />
        <p className={styles.hint}>Зарандаа онцлох гарчиг өгнө үү. Энэ хэсгийг хоосон үлдээвэл ранкийг ашиглах болно.</p>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.field}>
          <label htmlFor="sell-rank">Ранк / Түвшин</label>
          <div className={styles.selectWrap}>
            <select id="sell-rank" value={draft.rank} onChange={(e) => onChange({ rank: e.target.value })}>
              <option value="">Ранк сонгох</option>
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
          <label htmlFor="sell-price">Үнэ (₮) *</label>
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
            <b>Үнийн санал авах</b> — Худалдан авагч бага үнэ санал болгоход та зөвшөөрж, татгалж болно. Үүнийг унтраавал таны үнэ хөдөлгөөнгүй (тогтмол) болно.
          </span>
        </button>
      </div>

      <div className={styles.gamePanel}>
        <div className={styles.gamePanelHead}>
          {gameImage && <img src={gameImage} alt="" className={styles.gamePanelThumb} />}
          <div>
            <div className={styles.gamePanelTitle}>
              {gameName ? `${gameName} дэлгэрэнгүй` : 'Аккунтын дэлгэрэнгүй'}
            </div>
            <div className={styles.gamePanelSub}>Эдгээр дэлгэрэнгүй мэдээлэл нь худалдан авагчдад таны зарыг олоход тусална</div>
          </div>
        </div>
        <div className={styles.gameGrid}>
          {fields.map((field) => (
            <div key={field.key} className={styles.field}>
              <label htmlFor={`sell-detail-${field.key}`}>{field.label}</label>
              {field.kind === 'select' ? (
                <div className={styles.selectWrap}>
                  <select
                    id={`sell-detail-${field.key}`}
                    value={draft.detailValues[field.key] ?? ''}
                    onChange={(e) => setDetail(field.key, e.target.value)}
                  >
                    <option value="">Сонгох: {field.label.toLowerCase()}</option>
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
                  type={field.numeric ? 'number' : 'text'}
                  min={field.numeric ? 0 : undefined}
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
          <label htmlFor="sell-description">Тайлбар</label>
          <span className={styles.counter}>
            {draft.description.length}/{DESCRIPTION_LIMIT}
          </span>
        </div>
        <div className={styles.toolbar} role="toolbar" aria-label="Тайлбар форматлах">
          <button type="button" title="Буцаах" aria-label="Буцаах" onClick={undo}>
            ↩
          </button>
          <button type="button" title="Дахин хийх" aria-label="Дахин хийх" onClick={redo}>
            ↪
          </button>
          <button type="button" title="Тод" aria-label="Тод" onClick={() => wrap('**')}>
            <b>B</b>
          </button>
          <button type="button" title="Хэвтээ" aria-label="Хэвтээ" onClick={() => wrap('*')}>
            <i>I</i>
          </button>
          <button type="button" title="Жагсаалт" aria-label="Жагсаалт" onClick={() => prefixLines(() => '- ')}>
            ☰
          </button>
          <button type="button" title="Дугаарласан жагсаалт" aria-label="Дугаарласан жагсаалт" onClick={() => prefixLines((i) => `${i + 1}. `)}>
            1☰
          </button>
          <button type="button" title="Холбоос" aria-label="Холбоос" onClick={() => wrap('[', '](url)')}>
            🔗
          </button>
          <button
            type="button"
            title="Эможи"
            aria-label="Эможи"
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
          placeholder="Аккунтынхаа талаар тодорхойлно уу — онцлох зүйлс, нөөц, скин гэх мэт."
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <div className={styles.descFoot}>
          <span>{wordCount} үг</span>
          <span>
            {draft.description.length}/{DESCRIPTION_LIMIT}
          </span>
        </div>
      </div>
    </div>
  );
}