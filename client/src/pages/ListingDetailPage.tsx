import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { useAccounts } from '../hooks/useAccounts';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useWishlist } from '../context/WishlistContext';
import { ListingCard } from '../components/marketplace/ListingCard';
import { Lightbox } from '../components/marketplace/Lightbox';
import { BuyModal } from '../components/marketplace/BuyModal';
import { RentModal } from '../components/marketplace/RentModal';
import { QPayCheckoutModal } from '../components/marketplace/QPayCheckoutModal';
import { OfferModal } from '../components/chat/OfferModal';
import { fetchOrder, fetchRental } from '../services/accounts';
import { createQPayInvoice } from '../services/payments';
import { createOffer, openSellerThread } from '../services/chat';
import type { PurchaseOrder, QPayPayment, RentalOrder } from '../types';
import { formatPrice, formatRentalPrice, rentalUnitLabel, timeAgo } from '../utils/format';
import styles from './ListingDetailPage.module.css';

const FALLBACK_COLORS = ['#e5344a', '#3a6ee5', '#33a17a', '#c78b1f', '#8b5ce5'];

export function ListingDetailPage({ id }: { id: number }) {
  const navigate = useNavigate();
  const { account, loading, error } = useAccount(id);
  const { accounts } = useAccounts();
  const { user } = useCurrentUser();
  const { ids, toggle } = useWishlist();
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [shared, setShared] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [rental, setRental] = useState<RentalOrder | null>(null);
  const [checkout, setCheckout] = useState<QPayPayment | null>(null);

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.state}>Уншиж байна…</p>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className={styles.page}>
        <p className={styles.state}>Зарын мэдээллийг ачаалж чадсангүй ({error ?? 'олдсонгүй'}).</p>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/marketplace')}>
          Зарын хэсэг рүү буцах
        </button>
      </main>
    );
  }

  const photos = account.images.map((img) => img.image).filter((src): src is string => src !== null);
  const shown = Math.min(activePhoto, Math.max(photos.length - 1, 0));  const color = FALLBACK_COLORS[account.id % FALLBACK_COLORS.length];
  const isRent = account.kind === 'rent';
  const similar = accounts
    .filter((a) => a.id !== account.id && a.kind === account.kind && account.game !== null && a.game === account.game)
    .slice(0, 4);
  const sellerInitial = account.seller.charAt(0).toUpperCase() || '?';
  const isOwner = user?.username === account.seller;
  const sold = account.status === 'sold' || account.status === 'rented' || order !== null || rental !== null;
  const soldLabel = account.status === 'rented' || rental !== null ? 'Түрээслэгдсэн' : 'Зарагдсан';
  const paidPrice = account.sold_price ?? order?.amount ?? rental?.total ?? null;
  const isBuyer = order !== null || (account.sold_price !== null && !isOwner);
  const longDescription = account.description.length > 280;

  const handlePaid = (paid: QPayPayment) => {
    setCheckout(null);
    if (paid.kind === 'rent') {
      fetchRental(paid.account_id).then(setRental, () => {
        setRental({
          order_id: paid.id,
          account_id: paid.account_id,
          unit: account.rental_unit ?? 'day',
          duration: paid.duration,
          unit_price: account.price,
          total: paid.amount,
          status: 'active',
          start_at: paid.paid_at ?? new Date().toISOString(),
          end_at: paid.paid_at ?? new Date().toISOString(),
          is_renter: true,
          is_owner: false,
        });
      });
    } else {
      fetchOrder(paid.account_id).then(
        (escrow) => {
          setOrder({
            order_id: escrow.order_id,
            account_id: escrow.account_id,
            amount: escrow.amount,
            status: escrow.status,
            sold_at: escrow.sold_at,
          });
        },
        () => {
          setOrder({
            order_id: paid.id,
            account_id: paid.account_id,
            amount: paid.amount,
            status: 'held',
            sold_at: paid.paid_at ?? new Date().toISOString(),
          });
        },
      );
    }
  };

  const share = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(
      () => setShared(true),
      () => setShared(false),
    );
  };

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        ← Буцах
      </button>
      <div className={styles.crumbs}>
        <Link to="/">Нүүр</Link> &nbsp;›&nbsp;{' '}
        {isRent ? <Link to="/rent">Түрээс</Link> : <Link to="/marketplace">Зарын хэсэг</Link>} &nbsp;›&nbsp;{' '}
        <span className={styles.cur}>{account.title.length > 28 ? `${account.title.slice(0, 28)}…` : account.title}</span>
      </div>

      <div className={styles.top}>
        <section aria-label="Зургууд">
          <div
            className={styles.main}
            style={photos.length === 0 ? { background: `linear-gradient(135deg, ${color}22, ${color}44)` } : undefined}
          >
            {photos.length > 0 && (
              <button
                type="button"
                className={styles.mainZoom}
                aria-label="Зургийг томруулж харах"
                onClick={() => setLightboxIndex(shown)}
              >
                <img src={photos[shown]} alt={account.title} className={styles.mainImg} />
              </button>
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.prev}`}
                  aria-label="Өмнөх зураг"
                  onClick={() => setActivePhoto((shown + photos.length - 1) % photos.length)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.next}`}
                  aria-label="Дараагийн зураг"
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
                  aria-label={`Зураг ${i + 1}`}
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
              <div className={styles.sellerSub}>Зарагч</div>
            </div>
          </div>
          <div className={styles.escrowNote}>
            <b>🛡 Баталгаажтал мөнгө 100% хамгаалагдана</b>
            <p>Төлбөр дундын дансанд байрших бөгөөд  худалдан авалтаа баталгаажуулсны дараа таны мөнгийг хүлээлгэнэ өгнө.</p>
          </div>
          {isOwner ? (
            <div className={styles.sideRow}>
              <p className={styles.tos}>Энэ бол таны зар</p>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/sell')}>
                Миний зарууд
              </button>
            </div>
          ) : sold ? (
            <>
              <div className={styles.soldBadge}>{soldLabel}</div>
              {paidPrice !== null && (
                <p className={styles.tos}>
                  Төлсөн үнэ: {formatPrice(paidPrice)}
                  {isBuyer ? ' (таны худалдан авалт)' : ''}
                </p>
              )}
              <div className={styles.sideRow}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={chatStarting}
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    setChatStarting(true);
                    setChatError(null);
                    openSellerThread(account.seller, account.id).then(
                      (conversationId) => {
                        navigate(`/messages?conversation=${conversationId}`);
                      },
                      (err: unknown) => {
                        setChatStarting(false);
                        setChatError(err instanceof Error ? err.message : 'Чат нээж чадсангүй.');
                      },
                    );
                  }}
                >
                  {chatStarting ? 'Нээж байна…' : '💬 Асуулт асуух'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn-primary ${styles.buyBtn}`}
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  if (isRent) {
                    setRentOpen(true);
                  } else {
                    setBuyOpen(true);
                  }
                }}
              >
                {isRent ? '🔑 Баталгаатай түрээслэх' : '🛒 Баталгаатай худалдан авах'}
              </button>
              <div className={styles.sideRow}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={chatStarting}
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    setChatStarting(true);
                    setChatError(null);
                    openSellerThread(account.seller, account.id).then(
                      (conversationId) => {
                        navigate(`/messages?conversation=${conversationId}`);
                      },
                      (err: unknown) => {
                        setChatStarting(false);
                        setChatError(err instanceof Error ? err.message : 'Чат нээж чадсангүй.');
                      },
                    );
                  }}
                >
                  {chatStarting ? 'Нээж байна…' : '💬 Асуулт асуух'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  aria-pressed={ids.has(account.id)}
                  onClick={() => toggle(account.id)}
                >
                  {ids.has(account.id) ? '♥ Хадгалагдсан' : '♡ Хадгалах'}
                </button>
              </div>
              {chatError && (
                <p className={styles.tos} role="alert">
                  {chatError}
                </p>
              )}
              {account.accept_offers && (
                <button
                  type="button"
                  className={`btn btn-outline ${styles.offerBtn}`}
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    setOfferOpen(true);
                  }}
                >
                  ✋ Үнэ санал болгох
                </button>
              )}
            </>
          )}
          <p className={styles.tos}>Данс шилжүүлэх нь тухайн тоглоомын үйлчилгээний нөхцөлийг зөрчиж болзошгүйг анхаарна уу.</p>
        </aside>
      </div>

      <div className={styles.titleRow}>
        <div>
          {account.game && <span className={styles.gameTag}>{account.game}</span>}
          <h1 className={styles.title}>{account.title}</h1>
        </div>
        <div className={styles.priceBlock}>
          <div className={styles.price}>
            {isRent ? formatRentalPrice(account.price, account.rental_unit) : formatPrice(account.price)}
          </div>
          <div className={styles.meta}>
            {timeAgo(account.created_at)}
            {isRent && rental && (
              <>
                {' '}
                · {rental.duration} {rentalUnitLabel(rental.unit)} түрээслэв
              </>
            )}
          </div>
        </div>
      </div>

      {(account.game_rank || account.listings.length > 0) && (
        <div className={styles.stats}>
          {account.game_rank && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Ранк / Түвшин</span>
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
              {expanded ? 'Хураах ▴' : 'Дэлгэрэнгүй ▾'}
            </button>
          )}
        </section>
      )}

      {similar.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>{isRent ? 'Төстэй түрээсүүд' : 'Төстэй зарууд'}</h2>
          <div className={styles.similarGrid}>
            {similar.map((item, i) => (
              <ListingCard key={item.id} listing={item} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* <section>
        <h2 className={styles.sectionTitle}>Хэрэгцээт зөвлөмжүүд</h2>
        <div className={styles.guides}>
          <a href="#" className={styles.guide}>
            <b>Зөвлөмж</b>
            <span>{account.game ?? 'Тоглоомын'} хаягийг хэрхэн аюулгүй худалдаж авах вэ</span>
          </a>
          <a href="#" className={styles.guide}>
            <b>Зөвлөмж</b>
            <span>Дундын escrow систем таны худалдан авалтыг хэрхэн хамгаалдаг вэ</span>
          </a>
        </div>
      </section> */}

      <div className={styles.footRow}>
        <button type="button" className="btn btn-outline" onClick={share}>
          {shared ? '✓ Холбоос хуулагдлаа' : '⤴ Хуваалцах'}
        </button>
        <button type="button" className="btn btn-outline">
          ⚐ Мэдэгдэх
        </button>
      </div>

      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          title={account.title}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {offerOpen && (
        <OfferModal
          askingPrice={account.price}
          onClose={() => setOfferOpen(false)}
          onSend={(amount) =>
            openSellerThread(account.seller, account.id).then((conversationId) =>
              createOffer(conversationId, amount).then(() => {
                setOfferOpen(false);
                navigate(`/messages?conversation=${conversationId}`);
              }),
            )
          }
        />
      )}

      {buyOpen && !isRent && (
        <BuyModal
          price={account.price}
          onClose={() => setBuyOpen(false)}
          onConfirm={() => createQPayInvoice(account.id, 'sale')}
          onDone={(payment) => {
            setBuyOpen(false);
            setCheckout(payment);
          }}
        />
      )}

      {rentOpen && isRent && account.rental_unit && (
        <RentModal
          price={account.price}
          unit={account.rental_unit}
          onClose={() => setRentOpen(false)}
          onConfirm={(duration) => createQPayInvoice(account.id, 'rent', duration)}
          onDone={(payment) => {
            setRentOpen(false);
            setCheckout(payment);
          }}
        />
      )}

      {checkout && (
        <QPayCheckoutModal
          payment={checkout}
          onClose={() => setCheckout(null)}
          onPaid={handlePaid}
        />
      )}
    </main>
  );
}