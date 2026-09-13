import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchConversations } from '../services/chat';

const REFRESH_MS = 20000;

/** Total unread chat messages; 0 when logged out. Polls quietly in background. */
export function useUnreadMessages(): number {
  const { user, loading } = useAuth();
  const userId = !loading && user ? user.id : null;
  const [unread, setUnread] = useState(0);
  const [trackedId, setTrackedId] = useState<number | null>(userId);
  if (trackedId !== userId) {
    // Account switched or logged out: drop the previous count.
    setTrackedId(userId);
    setUnread(0);
  }

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    const load = () => {
      fetchConversations().then(
        (items) => {
          if (!cancelled) setUnread(items.reduce((sum, c) => sum + c.unread_count, 0));
        },
        () => {
          // Keep the last good count on failure.
        },
      );
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId]);

  return unread;
}
