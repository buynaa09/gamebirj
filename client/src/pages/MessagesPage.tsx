import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChatBubbleIcon, SearchIcon } from '../components/icons/Icons';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import {
  fetchConversation,
  fetchConversations,
  fetchLatestMessages,
  fetchMessages,
  markConversationRead,
  sendMessageRest,
} from '../services/chat';
import { timeAgo } from '../utils/format';
import type { ChatMessage, ChatServerEvent, ConversationListItem } from '../types';
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
  const { user, loading: authLoading } = useAuth();
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
  const [typingName, setTypingName] = useState<string | null>(null);

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
          created_at: event.created_at,
          is_read: event.is_read,
        };
        if (event.conversation_id === openId) {
          appendMessage(incoming);
          if (user && event.sender.id !== user.id) {
            // Our socket is open: persist read state server-side.
            sendReadRef.current();
            patchConversation(event.conversation_id, {
              last_message: event.content,
              last_message_at: event.created_at,
              unread_count: 0,
            });
          } else {
            patchConversation(event.conversation_id, {
              last_message: event.content,
              last_message_at: event.created_at,
            });
          }
        } else {
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === event.conversation_id
                ? {
                    ...c,
                    last_message: event.content,
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
    [appendMessage, conversations, patchConversation, user],
  );

  const { connected, sendMessage, sendRead, sendTyping } = useChatSocket(selectedId, {
    onEvent: handleServerEvent,
    enabled: !authLoading && user !== null && selectedId !== null,
  });

  useEffect(() => {
    sendReadRef.current = sendRead;
  }, [sendRead]);

  // --- Sending -------------------------------------------------------------
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || selectedId === null) return;
    setSendError(null);
    setDraft('');
    sendTyping(false);
    typingSentAt.current = 0;
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
  }, [draft, selectedId, sendMessage, sendTyping, appendMessage, patchConversation]);

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
                <span className={styles.statusText}>
                  {!connected ? 'Холбогдож байна…' : typingName ? 'Бичиж байна…' : 'Идэвхтэй'}
                </span>
              </div>
            </header>

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
              {!threadLoading &&
                !threadError &&
                messages.map((m) => {
                  const own = user !== null && m.sender.id === user.id;
                  return (
                    <div key={m.id} className={`${styles.bubbleRow} ${own ? styles.own : ''}`}>
                      <div className={styles.bubble}>
                        <p className={styles.bubbleText}>{m.content}</p>
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
            <form
              className={styles.composer}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                className={styles.input}
                rows={1}
                placeholder="Зурвас бичих…"
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
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                Илгээх
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
