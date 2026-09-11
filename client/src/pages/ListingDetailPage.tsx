import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { useAccounts } from '../hooks/useAccounts';
import { ListingCard } from '../components/marketplace/ListingCard';
import { formatPrice, timeAgo } from '../utils/format';
import styles from './ListingDetailPage.module.css';

const FALLBACK_COLORS = ['#e5344a', '#3a6ee5', '#33a17a', '#c78b1f', '#8b5ce5'];

export function ListingDetailPage({ id }: { id: number }) {
  const navigate = useNavigate();
  const { account, loading, error } = useAccount(id);
  const { accounts } = useAccounts();
  const [activePhoto, setActivePhoto] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [shared, setShared] = useState(false);

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.state}>Loading listing…</p>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className={styles.page}>
        <p className={styles.state}>Couldn't load this listing ({error ?? 'not found'}).</p>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/marketplace')}>
          Back to marketplace
        </button>
      </main>
    );
  }

  const photos = account.images.map((img) => img.image).filter((src): src is string => src !== null);
  const shown = Math.min(activePhoto, Math.max(photos.length - 1, 0));
  const color = FALLBACK_COLORS[account.id % FALLBACK_COLORS.length];
  const similar = accounts
    .filter((a) => a.id !== account.id && account.game !== null && a.game === account.game)
    .slice(0, 4);
  const sellerInitial = account.seller.charAt(0).toUpperCase() || '?';
  const longDescription = account.description.length > 280;

  const share = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard
        .then(() => setShared(true))
        .catch(() => setShared(false));
      navigator.clipboard.writeText(url).then(
        () => setShared(true),
        () => setShared(false),
      );
    }
  };

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className={styles.crumbs}>
        <Link to="/">Home</Link> &nbsp;›&nbsp; <Link to="/marketplace">Marketplace</Link> &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>{account.title.length > 28 ? `${account.title.slice(0, 28)}…` : account.title}</span>
      </div>

      <div className={styles.top}>
        <section aria-label="Photos">
          <div
            className={styles.main}
            style={photos.length === 0 ? { background: `linear-gradient(135deg, ${color}22, ${color}44)` } : undefined}
          >
            {photos.length > 0 && (
              <img src={photos[shown]} alt={account.title} className={styles.mainImg} />
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.prev}`}
                  aria-label="Previous photo"
                  onClick={() => setActivePhoto((shown + photos.length - 1) % photos.length)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.next}`}
                  aria-label="Next photo"
                  onClick={() => setActivePhoto((shown + 1) % photos.length)}
                >
                  ›
                </button>
                <span className={styles.counter}>
                  {shown + 1} / {photos.length}
                </span>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className={styles.thumbs}>
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className={`${styles.thumb} ${i === shown ? styles.thumbActive : ''}`}
                  onClick={() => setActivePhoto(i)}
                  aria-label={`Photo ${i + 1}`}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.side}>
          <div className={styles.sellerRow}>
            <span className={styles.sellerDot}>{sellerInitial}</span>
            <div>
              <div className={styles.sellerName}>{account.seller}</div>
              <div className={styles.sellerSub}>Seller</div>
            </div>
          </div>
          <div className={styles.escrowNote}>
            <b>🛡 100% money-back until you confirm</b>
            <p>Payment is held in escrow and released only after you confirm delivery.</p>
          </div>
          <button type="button" className={`btn btn-primary ${styles.buyBtn}`}>
            🛒 Buy with Escrow
          </button>
          <div className={styles.sideRow}>
            <button type="button" className="btn btn-outline">
              💬 Ask a Question
            </button>
            <button type="button" className="btn btn-outline">
              ♡ Wishlist
            </button>
          </div>
          {account.accept_offers && (
            <button type="button" className={`btn btn-outline ${styles.offerBtn}`}>
              ✋ Make an offer
            </button>
          )}
          <p className={styles.tos}>Account transfers may violate the game publisher's Terms of Service. Purchase at your own risk.</p>
        </aside>
      </div>

      <div className={styles.titleRow}>
        <div>
          {account.game && <span className={styles.gameTag}>{account.game}</span>}
          <h1 className={styles.title}>{account.title}</h1>
        </div>
        <div className={styles.priceBlock}>
          <div className={styles.price}>{formatPrice(account.price)}</div>
          <div className={styles.meta}>{timeAgo(account.created_at)}</div>
        </div>
      </div>

      {(account.game_rank || account.listings.length > 0) && (
        <div className={styles.stats}>
          {account.game_rank && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Rank / Level</span>
              <span className={styles.statValue}>{account.game_rank}</span>
            </div>
          )}
          {account.listings.map((detail) => (
            <div key={detail.listing_id} className={styles.stat}>
              <span className={styles.statLabel}>{detail.title}</span>
              <span className={styles.statValue}>
                {detail.choices.length > 0 ? detail.choices.join(', ') : detail.value || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {account.description.trim() !== '' && (
        <section className={styles.desc}>
          <p className={expanded ? undefined : styles.clamp}>{account.description}</p>
          {longDescription && (
            <button type="button" className={styles.seeMore} onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'See less ▴' : 'See more ▾'}
            </button>
          )}
        </section>
      )}

      {similar.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Similar Listings</h2>
          <div className={styles.similarGrid}>
            {similar.map((item, i) => (
              <ListingCard key={item.id} listing={item} index={i} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Helpful guides</h2>
        <div className={styles.guides}>
          <a href="#" className={styles.guide}>
            <b>Guide</b>
            <span>How to buy a {account.game ?? 'gaming'} account safely</span>
          </a>
          <a href="#" className={styles.guide}>
            <b>Guide</b>
            <span>How Midman escrow protects your purchase</span>
          </a>
        </div>
      </section>

      <div className={styles.footRow}>
        <button type="button" className="btn btn-outline" onClick={share}>
          {shared ? '✓ Link copied' : '⤴ Share'}
        </button>
        <button type="button" className="btn btn-outline">
          ⚐ Report
        </button>
      </div>
    </main>
  );
}
