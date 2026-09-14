import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ChatBubbleIcon, ImageIcon, SearchIcon, SendIcon } from '../components/icons/Icons';
import { OfferCard } from '../components/chat/OfferCard';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useChatSocket } from '../hooks/useChatSocket';
import { confirmReceipt, fetchAccount, fetchOrder } from '../services/accounts';
import {
  acceptOffer,
  cancelOffer,
  declineOffer,
  fetchConversation,
  fetchConversations,
  fetchLatestMessages,
  fetchMessages,
  markConversationRead,
  sendMessageRest,
  sendMessageWithImage,
} from '../services/chat';
import { resolveMediaUrl } from '../services/api';
import { formatPrice, timeAgo } from '../utils/format';
import type {
  ChatMessage,
  ChatServerEvent,
  ConversationListItem,
  EscrowOrder,
  MarketAccount,
  Offer,
} from '../types';
import styles from './MessagesPage.module.css';

const LIST_REFRESH_MS = 20000;
const TYPING_CLEAR_MS = 4000;

function displayName(item: ConversationListItem): string {
  return item.other_user.name || item.other_user.username;
}

function messageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

export function MessagesPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get('conversation')) || null;

  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(() => selectedId !== null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [oldestPage, setOldestPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [attached, setAttached] = useState<{ file: File; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [listing, setListing] = useState<MarketAccount | null>(null);
  const [offerBusy, setOfferBusy] = useState<number | null>(null);
  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmArmed, setConfirmArmed] = useState(false);

  const typingTimer = useRef<number | null>(null);
  const typingSentAt = useRef(0);
  const sendReadRef = useRef(() => {});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<number | null>(null);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const selectConversation = useCallback(
    (id: number | null) => {
      setMessages([]);
      setThreadError(null);
      setTypingName(null);
      setSendError(null);
      setListing(null);
      setOrder(null);
      setConfirmArmed(false);
      setAttached((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview);
        return null;
      });
      setThreadLoading(id !== null);
      if (id === null) {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ conversation: String(id) }, { replace: true });
      }
    },
    [setSearchParams],
  );

  const patchConversation = useCallback((id: number, patch: Partial<ConversationListItem>) => {
    setConversations((prev) => prev.map((c) => (c.conversation_id === id ? { ...c, ...patch } : c)));
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      const next = [...prev, message];
      next.sort((a, b) => a.id - b.id);
      return next;
    });
  }, []);

  const applyOffer = useCallback((offer: Offer) => {
    setMessages((prev) =>
      prev.map((m) => (m.offer?.id === offer.id ? { ...m, offer } : m)),
    );
  }, []);

  // --- Conversation list -------------------------------------------------
  useEffect(() => {
    if (authLoading || !user) {
      return;
    }
    let cancelled = false;
    const settle = (items: ConversationListItem[]) => {
      if (cancelled) return;
      setConversations(items);
      setListError(null);
      setListLoading(false);
    };
    fetchConversations().then(settle, (err: unknown) => {
      if (cancelled) return;
      setListError(err instanceof Error ? err.message : 'Жагсаалтыг ачаалж чадсангүй.');
      setListLoading(false);
    });
    const timer = window.setInterval(() => {
      // Silent background refresh: keep the last good list on failure.
      fetchConversations().then(settle, () => {});
    }, LIST_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authLoading, user]);

  // If the selected conversation is missing from the list (e.g. just created
  // from a listing page), fetch it directly and prepend it.
  useEffect(() => {
    if (!user || selectedId === null) return;
    if (conversations.some((c) => c.conversation_id === selectedId)) return;
    let cancelled = false;
    fetchConversation(selectedId)
      .then((conv) => {
        if (cancelled) return;
        setConversations((prev) => [
          {
            conversation_id: conv.id,
            other_user: conv.other_user,
            account_id: conv.account_id,
            agreed_price: conv.agreed_price,
            last_message: null,
            last_message_at: null,
            unread_count: 0,
          },
          ...prev,
        ]);
      })
      .catch(() => {
        if (!cancelled) selectConversation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, selectedId, conversations, selectConversation]);

  // Listing linked to the open conversation (powers the trade card + seller panel).
  const selectedAccountId =
    conversations.find((c) => c.conversation_id === selectedId)?.account_id ?? null;

  const refreshListing = useCallback(() => {
    if (selectedAccountId === null) {
      return;
    }
    fetchAccount(selectedAccountId).then(setListing, () => {
      setListing(null);
    });
    fetchOrder(selectedAccountId).then(setOrder, () => {
      setOrder(null);
    });
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId === null) {
      return;
    }
    let cancelled = false;
    fetchAccount(selectedAccountId).then(
      (account) => {
        if (!cancelled) setListing(account);
      },
      () => {
        if (!cancelled) setListing(null);
      },
    );
    // Escrow state: only buyer/seller get an order; others get 404 → null.
    fetchOrder(selectedAccountId).then(
      (escrow) => {
        if (!cancelled) setOrder(escrow);
      },
      () => {
        if (!cancelled) setOrder(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  // --- Thread history ----------------------------------------------------
  useEffect(() => {
    if (!user || selectedId === null) {
      return;
    }
    let cancelled = false;
    fetchLatestMessages(selectedId)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items);
        setTotalMessages(page.total);
        setOldestPage(page.page);
        // Mark the other's messages as read (persists + broadcasts message.read).
        return markConversationRead(selectedId).then((result) => {
          if (!cancelled && result.read > 0) patchConversation(selectedId, { unread_count: 0 });
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setThreadError(err instanceof Error ? err.message : 'Зурвасуудыг ачаалж чадсангүй.');
        }
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, selectedId, patchConversation]);

  const loadOlder = useCallback(async () => {
    if (selectedId === null || loadingOlder || oldestPage <= 1) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages(selectedId, oldestPage - 1);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const older = page.items.filter((m) => !ids.has(m.id));
        return [...older, ...prev];
      });
      setOldestPage(page.page);
      setTotalMessages(page.total);
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Зурвасуудыг ачаалж чадсангүй.');
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedId, loadingOlder, oldestPage]);

  // --- WebSocket events ---------------------------------------------------
  const handleServerEvent = useCallback(
    (event: ChatServerEvent) => {
      const openId = selectedRef.current;
      if (event.type === 'message.created') {
        const incoming: ChatMessage = {
          id: event.id,
          conversation_id: event.conversation_id,
          sender: event.sender,
          content: event.content,
          image: resolveMediaUrl(event.image),
          created_at: event.created_at,
          is_read: event.is_read,
          offer: event.offer,
        };
        const preview = event.content || (event.image ? '🖼 Зураг' : '');
        if (event.conversation_id === openId) {
          appendMessage(incoming);
          if (user && event.sender.id !== user.id) {
            // Our socket is open: persist read state server-side.
            sendReadRef.current();
            patchConversation(event.conversation_id, {
              last_message: preview,
              last_message_at: event.created_at,
              unread_count: 0,
            });
          } else {
            patchConversation(event.conversation_id, {
              last_message: preview,
              last_message_at: event.created_at,
            });
          }
        } else {
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === event.conversation_id
                ? {
                    ...c,
                    last_message: preview,
                    last_message_at: event.created_at,
                    unread_count: c.unread_count + 1,
                  }
                : c,
            ),
          );
        }
      } else if (event.type === 'message.read') {
        if (user && event.user_id !== user.id && openId !== null) {
          setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
        }
      } else if (event.type === 'offer.updated') {
        applyOffer(event.offer);
        patchConversation(event.offer.conversation_id, {
          agreed_price: event.agreed_price,
        });
        if (event.offer.status === 'accepted') {
          refreshListing();
        }
      } else if (event.type === 'escrow.updated') {
        // Live escrow move (e.g. the other side confirmed): same listing only.
        const openConv = conversations.find((c) => c.conversation_id === openId);
        if (openConv && openConv.account_id === event.order.account_id) {
          setOrder(event.order);
          setConfirmArmed(false);
          refreshListing();
        }
      } else if (event.type === 'typing.started' || event.type === 'typing.stopped') {
        if (user && event.user_id !== user.id) {
          if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
          if (event.type === 'typing.started') {
            const item = conversations.find((c) => c.conversation_id === openId);
            setTypingName(item ? displayName(item) : '…');
            typingTimer.current = window.setTimeout(() => setTypingName(null), TYPING_CLEAR_MS);
          } else {
            setTypingName(null);
          }
        }
      } else if (event.type === 'error') {
        setSendError(event.detail);
      }
    },
    [appendMessage, applyOffer, conversations, patchConversation, refreshListing, user],
  );

  const { connected, sendMessage, sendRead, sendTyping } = useChatSocket(selectedId, {
    onEvent: handleServerEvent,
    enabled: !authLoading && user !== null && selectedId !== null,
    getToken,
  });

  useEffect(() => {
    sendReadRef.current = sendRead;
  }, [sendRead]);

  // --- Sending -------------------------------------------------------------
  const clearAttached = useCallback(() => {
    setAttached((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const attachImage = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSendError('Зөвхөн зураг хавсаргах боломжтой.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError('Зураг хэт том байна (хамгийн ихдээ 5 MB).');
      return;
    }
    setSendError(null);
    setAttached((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }, []);

  const send = useCallback(async () => {
    const content = draft.trim();
    if ((!content && !attached) || selectedId === null) return;
    setSendError(null);
    setDraft('');
    sendTyping(false);
    typingSentAt.current = 0;
    if (attached) {
      const image = attached;
      clearAttached();
      try {
        const saved = await sendMessageWithImage(selectedId, content, image.file);
        appendMessage(saved);
        patchConversation(selectedId, {
          last_message: saved.content || (saved.image ? '🖼 Зураг' : ''),
          last_message_at: saved.created_at,
        });
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Зураг илгээж чадсангүй.');
        setDraft(content);
      }
      return;
    }
    if (sendMessage(content)) return; // Server echo appends it.
    try {
      const saved = await sendMessageRest(selectedId, content);
      appendMessage(saved);
      patchConversation(selectedId, {
        last_message: saved.content,
        last_message_at: saved.created_at,
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Зурвас илгээж чадсангүй.');
      setDraft(content);
    }
  }, [draft, attached, selectedId, sendMessage, sendTyping, appendMessage, patchConversation, clearAttached]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (value.trim() && Date.now() - typingSentAt.current > 4000) {
        typingSentAt.current = Date.now();
        sendTyping(true);
      }
    },
    [sendTyping],
  );

  // --- Offer decisions -------------------------------------------------------
  const decideOffer = useCallback(
    (offer: Offer, action: 'accept' | 'decline' | 'cancel') => {
      setOfferBusy(offer.id);
      const request =
        action === 'accept'
          ? acceptOffer(offer.id)
          : action === 'decline'
            ? declineOffer(offer.id)
            : cancelOffer(offer.id);
      request.then(
        (updated) => {
          applyOffer(updated);
          if (updated.status === 'accepted') {
            refreshListing();
          }
        },
        (err: unknown) => {
          setSendError(err instanceof Error ? err.message : 'Санал шинэчилж чадсангүй.');
        },
      ).finally(() => {
        setOfferBusy((busy) => (busy === offer.id ? null : busy));
      });
    },
    [applyOffer, refreshListing],
  );

  // --- Escrow confirm --------------------------------------------------------
  // Two-click arm: releasing money is irreversible, so the first click only arms.
  const confirmEscrow = useCallback(() => {
    if (selectedAccountId === null || confirmBusy) return;
    if (!confirmArmed) {
      setConfirmArmed(true);
      return;
    }
    setConfirmBusy(true);
    setSendError(null);
    confirmReceipt(selectedAccountId).then(
      (updated) => {
        setOrder(updated);
        setConfirmArmed(false);
      },
      (err: unknown) => {
        setSendError(err instanceof Error ? err.message : 'Баталгаажуулж чадсангүй.');
      },
    ).finally(() => {
      setConfirmBusy(false);
    });
  }, [selectedAccountId, confirmBusy, confirmArmed]);

  // --- Auto-scroll ----------------------------------------------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedId, typingName]);

  // --- Derived ---------------------------------------------------------------
  const q = query.trim().toLowerCase();
  const visible = conversations.filter((c) => {
    if (!q) return true;
    const name = displayName(c).toLowerCase();
    return name.includes(q) || c.other_user.username.toLowerCase().includes(q);
  });
  const selected = conversations.find((c) => c.conversation_id === selectedId) ?? null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const hasOlder = messages.length < totalMessages;
  const otherIsSeller =
    listing !== null && selected !== null && listing.seller === selected.other_user.username;
  const roleLabel =
    selected === null || listing === null ? null : otherIsSeller ? 'Зарагч' : 'Худалдан авагч';
  const statusLine = typingName
    ? 'Бичиж байна…'
    : (roleLabel ?? (!connected ? 'Холбогдож байна…' : 'Идэвхтэй'));

  if (!authLoading && !user) {
    return (
      <main className={styles.page}>
        <section className={styles.listPanel} aria-label="Харилцан ярианууд">
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Нэвтэрч орно уу</p>
            <p className={styles.emptySub}>Зурвасуудаа харахын тулд эхлээд нэвтэрнэ үү.</p>
            <Link className="btn btn-primary" to="/login">
              Нэвтрэх
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${selectedId !== null ? styles.threadOpen : ''}`}>
      <section className={styles.listPanel} aria-label="Харилцан ярианууд">
        <div className={styles.listHead}>
          <h1 className={styles.title}>
            Зурвасууд
            {totalUnread > 0 && <span className={styles.totalBadge}>{totalUnread}</span>}
          </h1>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon size={15} />
          </span>
          <input
            className={styles.search}
            type="search"
            placeholder="Нэрээр хайх"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Нэрээр хайх"
          />
        </div>

        <div className={styles.threads}>
          {listLoading && <p className={styles.noResults}>Уншиж байна…</p>}
          {listError && <p className={styles.errorText}>{listError}</p>}
          {!listLoading &&
            !listError &&
            visible.map((c) => (
              <button
                key={c.conversation_id}
                className={`${styles.thread} ${selectedId === c.conversation_id ? styles.threadActive : ''}`}
                onClick={() => selectConversation(c.conversation_id)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {displayName(c).charAt(0).toUpperCase()}
                </span>
                <span className={styles.threadMeta}>
                  <span className={styles.threadName}>{displayName(c)}</span>
                  <span className={styles.threadSub}>{c.last_message ?? 'Хоосон харилцан яриа'}</span>
                </span>
                <span className={styles.threadSide}>
                  {c.last_message_at && <span className={styles.threadTime}>{timeAgo(c.last_message_at)}</span>}
                  {c.unread_count > 0 && <span className={styles.unreadBadge}>{c.unread_count}</span>}
                </span>
              </button>
            ))}
          {!listLoading && !listError && visible.length === 0 && (
            <p className={styles.noResults}>Харилцан яриа олдсонгүй.</p>
          )}
        </div>
      </section>

      <section className={styles.detailPanel} aria-label="Зурвасын дэлгэрэнгүй">
        {selectedId === null || !selected ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <ChatBubbleIcon size={20} />
            </span>
            <p className={styles.emptyTitle}>Харилцан яриа сонгоно уу</p>
            <p className={styles.emptySub}>Зүүн талын жагсаалтаас сонгож зурвасуудаа харна уу.</p>
          </div>
        ) : (
          <div className={styles.chatThread}>
            <header className={styles.threadHead}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => selectConversation(null)}
                aria-label="Буцах"
              >
                ‹
              </button>
              <span className={styles.avatar} aria-hidden="true">
                {displayName(selected).charAt(0).toUpperCase()}
              </span>
              <div className={styles.threadHeadMeta}>
                <strong>{displayName(selected)}</strong>
                <span className={styles.statusText}>{statusLine}</span>
              </div>
            </header>

            {listing && (
              <div className={styles.tradeCard}>
                {selected.agreed_price != null && (
                  <p className={styles.agreedBar}>
                    <span>✓ Зөвшөөрсөн үнэ (зөвхөн та хоёр)</span>
                    <strong>{formatPrice(selected.agreed_price)}</strong>
                  </p>
                )}
                {listing.images[0]?.image && (
                  <img
                    className={styles.tradeThumb}
                    src={listing.images[0].image}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div className={styles.tradeInfo}>
                  <p className={styles.tradeKicker}>Худалдаанд бэлэн</p>
                  <strong className={styles.tradeTitle}>{listing.title}</strong>
                  <span className={styles.tradeSub}>
                    {listing.game} • {formatPrice(listing.price)}
                  </span>
                  <p className={styles.tradeNote}>
                    Та баталгаажуултал мөнгө дундын дансанд хадгалагдана.
                  </p>
                  {listing.status === 'sold' && (
                    <p className={styles.tradeNote}>Энэ зар зарагдсан.</p>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.buyNow}
                  onClick={() => navigate(`/listing/${listing.id}`)}
                >
                  {listing.status === 'sold' ? 'Үзэх' : 'Buy now'}
                </button>
              </div>
            )}

            {order?.status === 'held' && order.is_buyer && (
              <div className={styles.escrowBanner} role="group" aria-label="Төлбөр баталгаажуулах">
                <p className={styles.escrowText}>
                  <strong>💰 Төлбөр дундын дансанд байна ({formatPrice(order.amount)}).</strong>
                  <span>Акаунтын мэдээллийг шалгаад зөв бол доорх товчийг дарна уу. Таны төлбөр зарагч руу шилжих болно.</span>
                </p>
                <button
                  type="button"
                  className={`${styles.confirmBtn} ${confirmArmed ? styles.confirmArmed : ''}`}
                  onClick={confirmEscrow}
                  disabled={confirmBusy}
                >
                  {confirmBusy
                    ? 'Илгээж байна…'
                    : confirmArmed
                      ? '⚠ Дахин дарж баталгаажуулна уу'
                      : '✓ Account зөв байна'}
                </button>
              </div>
            )}

            {order?.status === 'held' && order.is_seller && (
              <p className={styles.escrowNote} role="status">
                💰 Төлбөр ({formatPrice(order.amount)}) дундын дансанд байна. Худалдан авагч
                account шалгаад баталгаажуулахыг хүлээж байна.
              </p>
            )}

            {order?.status === 'released' && (
              <p className={styles.escrowDone} role="status">
                ✓ Төлбөр ({formatPrice(order.amount)}) зарагч руу шилжсэн. Арилжаа дууслаа.
              </p>
            )}

            {/* Mobile/tablet fallback for the sellerPanel "Stay safe" block,
                which is hidden below 1180px. Collapsed by default. */}
            <details className={styles.safetyFold}>
              <summary className={styles.safetySummary}>
                <span aria-hidden="true">🛡</span> Аюулгүй байдал
                <span className={styles.safetyChevron} aria-hidden="true">
                  ▾
                </span>
              </summary>
              <ul className={styles.safeList}>
                <li>OTP болон 2FA кодыг чатаас гадуур хэзээ ч бүү хуваалцаарай.</li>
                <li>Төлбөрөө суллахаасаа өмнө нэвтрэлтийг шалгаарай.</li>
                <li>Зөвхөн платформоор дамжуулан төлбөрөө төлөөрэй.</li>
              </ul>
            </details>

            <div className={styles.messages} ref={scrollRef} aria-live="polite">
              {hasOlder && (
                <button
                  type="button"
                  className={styles.loadOlder}
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                >
                  {loadingOlder ? 'Уншиж байна…' : 'Өмнөх зурвасууд'}
                </button>
              )}
              {threadLoading && <p className={styles.noResults}>Уншиж байна…</p>}
              {threadError && <p className={styles.errorText}>{threadError}</p>}
              {!threadLoading && !threadError && messages.length === 0 && (
                <div className={styles.noChat}>
                  <span className={styles.noChatIcon} aria-hidden="true">
                    <ChatBubbleIcon size={20} />
                  </span>
                  <p className={styles.noChatTitle}>Зурвас алга</p>
                  <p className={styles.noChatSub}>
                    {listing
                      ? `${listing.game ?? listing.title} заруудын талаар яриа эхлүүлээрэй`
                      : 'Сайн уу гэж бичээд яриагаа эхлүүлээрэй'}
                  </p>
                </div>
              )}
              {!threadLoading &&
                !threadError &&
                messages.map((m) => {
                  const own = user !== null && m.sender.id === user.id;
                  const offer = m.offer;
                  return (
                    <div key={m.id} className={`${styles.bubbleRow} ${own ? styles.own : ''}`}>
                      <div className={styles.bubble}>
                        {offer && (
                          <OfferCard
                            offer={offer}
                            isOwn={own}
                            busy={offerBusy === offer.id}
                            onAccept={() => decideOffer(offer, 'accept')}
                            onDecline={() => decideOffer(offer, 'decline')}
                            onCancel={() => decideOffer(offer, 'cancel')}
                          />
                        )}
                        {m.image && (
                          <a
                            href={m.image}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.bubbleImageLink}
                            aria-label="Зургийг бүтнээр харах"
                          >
                            <img src={m.image} alt="" loading="lazy" className={styles.bubbleImage} />
                          </a>
                        )}
                        {m.content && <p className={styles.bubbleText}>{m.content}</p>}
                        <span className={styles.bubbleMeta}>
                          {messageTime(m.created_at)}
                          {own && m.is_read ? ' • Уншсан' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} />
            </div>

            {sendError && (
              <p className={styles.errorText} role="alert">
                {sendError}
              </p>
            )}
            {attached && (
              <div className={styles.attachPreview}>
                <img src={attached.preview} alt="" className={styles.attachThumb} />
                <span className={styles.attachName}>{attached.file.name}</span>
                <button
                  type="button"
                  className={styles.attachRemove}
                  onClick={clearAttached}
                  aria-label="Хавсралтыг хасах"
                >
                  ✕
                </button>
              </div>
            )}
            <form
              className={styles.composer}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  attachImage(e.target.files?.[0]);
                }}
              />
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Зураг хавсаргах"
                title="Зураг хавсаргах"
              >
                <ImageIcon size={18} />
              </button>
              <textarea
                className={styles.input}
                rows={1}
                placeholder="Type a message… (Enter to send)"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onBlur={() => sendTyping(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                aria-label="Зурвас бичих"
              />
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={!draft.trim() && !attached}
                aria-label="Илгээх"
              >
                <SendIcon size={16} />
              </button>
            </form>
          </div>
        )}
      </section>

      {selected && listing && (
        <aside className={styles.sellerPanel} aria-label="Зарагчийн мэдээлэл">
          <p className={styles.sellerKicker}>Seller</p>
          <div className={styles.sellerTop}>
            <span className={styles.avatar} aria-hidden="true">
              {listing.seller.charAt(0).toUpperCase()}
            </span>
            <div className={styles.sellerTopMeta}>
              <strong>{listing.seller}</strong>
              <span className={styles.sellerProfile}>View profile</span>
            </div>
          </div>

          {/* <div className={styles.statRow}>
            <div className={styles.stat}>
              <strong>—</strong>
              <span>Rating</span>
            </div>
            <div className={styles.stat}>
              <strong>0</strong>
              <span>Sales</span>
            </div>
            <div className={styles.stat}>
              <strong>0</strong>
              <span>Disputes</span>
            </div>
          </div> */}

          <div className={styles.infoBlock}>
            <p className={styles.infoKicker}>How payment works</p>
            <p className={styles.infoText}>
              <strong>Баталгаажтал мөнгө 100% хамгаалагдана.</strong> Та баталгаажуулсны дараа
              зарагчид шилжинэ.
            </p>
          </div>

          <div className={styles.infoBlock}>
            <p className={styles.infoKicker}>Аюулгүй байдлын зөвлөмж</p>
            <ul className={styles.safeList}>
              <li>OTP болон 2FA нууц кодыг чатаас гадуур хэзээ ч бүү хуваалцаарай.</li>
              <li>Төлбөрөө баталгаажуулахаас өмнө нэвтрэх мэдээллийг заавал шалгаарай.</li>
              <li>Зөвхөн платформоор дамжуулан аюулгүй төлбөрөө хийгээрэй.</li>
            </ul>
          </div>
        </aside>
      )}
    </main>
  );
}
