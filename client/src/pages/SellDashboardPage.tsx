import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deleteAccount, fetchMyAccounts, updateAccount } from '../services/accounts';
import type { MarketAccount } from '../types';
import { formatPrice, timeAgo } from '../utils/format';
import styles from './SellDashboardPage.module.css';

export function SellDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MarketAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MarketAccount | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    fetchMyAccounts()
      .then((result) => {
        if (!cancelled) setAccounts(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ачаалж чадсангүй.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  const remove = (id: number) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    deleteAccount(id)
      .then(() => {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Устгаж чадсангүй.');
      });
  };

  return (
    <main className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/">Нүүр</Link> &nbsp;›&nbsp; <span className={styles.cur}>Зарах</span>
      </div>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Миний зарууд</h1>
          <p className={styles.subtitle}>
            {accounts.length === 0 && !loading
              ? 'Танд одоогоор зар байхгүй байна.'
              : `Идэвхтэй ${accounts.length} зар`}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/sell/processing')}>
          + Account зарах
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <p className={styles.state}>Уншиж байна…</p>
      ) : accounts.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>Анхны тоглоомын аккаунтын зараа оруулна уу — ердөө ганцхан минут зарцуулна.</p>
        
        </div>
      ) : (
        <ul className={styles.list}>
          {accounts.map((account) => {
            const cover = account.images.find((img) => img.image)?.image ?? null;
            return (
              <li key={account.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.thumb}
                  onClick={() => navigate(`/listing/${account.id}`)}
                  aria-label={`${account.title}-ийг харах`}
                >
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.thumbFallback}>
                      {(account.game ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                <div className={styles.info}>
                  <b className={styles.rowTitle}>{account.title}</b>
                  <span className={styles.rowMeta}>
                    {[account.game, account.game_rank].filter(Boolean).join(' · ')} ·{' '}
                    {timeAgo(account.created_at)}
                  </span>
                  <span className={styles.rowPrice}>{formatPrice(account.price)}</span>
                </div>
                <div className={styles.actions}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditing(account)}>
                    Засах
                  </button>
                  {confirmDelete === account.id ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => remove(account.id)}
                      >
                        Тийм
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Үгүй
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => remove(account.id)}
                    >
                      Устгах
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EditModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function EditModal({
  account,
  onClose,
  onSaved,
}: {
  account: MarketAccount;
  onClose: () => void;
  onSaved: (updated: MarketAccount) => void;
}) {
  const [title, setTitle] = useState(account.title);
  const [price, setPrice] = useState(String(account.price));
  const [description, setDescription] = useState(account.description);
  const [acceptOffers, setAcceptOffers] = useState(account.accept_offers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const save = () => {
    if (title.trim() === '') {
      setError('Гарчиг хоосон байж болохгүй.');
      return;
    }
    if (price.trim() === '' || Number(price) <= 0) {
      setError('Зөв үнэ оруулна уу.');
      return;
    }
    setError(null);
    setSaving(true);
    updateAccount(account.id, {
      title: title.trim(),
      price: price.trim(),
      description,
      accept_offers: acceptOffers,
    })
      .then(onSaved)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Хадгалж чадсангүй.');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Зарын мэдээлэл засах"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <b>Зар засах</b>
          <button type="button" className={styles.closeBtn} aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.field}>
          Гарчиг
          <input type="text" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          Үнэ (₮)
          <input
            type="number"
            min={1}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          Тайлбар
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={acceptOffers}
          className={styles.switchRow}
          onClick={() => setAcceptOffers((v) => !v)}
        >
          <span className={`${styles.switch} ${acceptOffers ? styles.switchOn : ''}`} aria-hidden="true">
            <span className={styles.knob} />
          </span>
          Үнийн санал авах
        </button>
        <div className={styles.modalFoot}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </div>
  );
}