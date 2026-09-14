import { useCallback, useEffect, useRef, useState } from 'react';
import { buildChatWsUrl } from '../services/chat';
import type { ChatServerEvent } from '../types';

const NORMAL_CLOSE = 1000;
const UNAUTHORIZED_CLOSE = 4401;
const FORBIDDEN_CLOSE = 4403;
const MAX_BACKOFF_MS = 10000;

function isServerEvent(value: unknown): value is ChatServerEvent {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as { type?: unknown }).type === 'string';
}

interface UseChatSocketOptions {
  /** Called for every parsed server event. */
  onEvent: (event: ChatServerEvent) => void;
  /** Set false while logged out so no socket is opened. */
  enabled: boolean;
  /** Resolves the Clerk session JWT appended as `?token=` (WS has no headers). */
  getToken?: () => Promise<string | null>;
}

export function useChatSocket(
  conversationId: number | null,
  { onEvent, enabled, getToken }: UseChatSocketOptions,
) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled || conversationId === null) {
      return;
    }

    let closed = false;
    clearTimer();
    attemptsRef.current = 0;

    const connect = () => {
      if (closed) return;
      void (async () => {
        if (closed) return;
        const token = await getTokenRef.current?.().catch(() => null);
        if (closed) return;
        const socket = new WebSocket(buildChatWsUrl(conversationId, token));
        socketRef.current = socket;

        socket.onopen = () => {
          if (closed) return;
          attemptsRef.current = 0;
          setConnected(true);
        };

        socket.onmessage = (e: MessageEvent<string>) => {
          try {
            const parsed: unknown = JSON.parse(e.data);
            if (isServerEvent(parsed)) onEventRef.current(parsed);
          } catch {
            // Ignore malformed frames.
          }
        };

        socket.onclose = (e: CloseEvent) => {
          if (socketRef.current === socket) socketRef.current = null;
          setConnected(false);
          if (closed) return;
          // Auth/permission rejections are final; normal close was intentional.
          if (e.code === UNAUTHORIZED_CLOSE || e.code === FORBIDDEN_CLOSE || e.code === NORMAL_CLOSE) {
            return;
          }
          attemptsRef.current += 1;
          const backoff = Math.min(1000 * 2 ** (attemptsRef.current - 1), MAX_BACKOFF_MS);
          timerRef.current = window.setTimeout(connect, backoff);
        };
      })();
    };

    connect();

    return () => {
      closed = true;
      clearTimer();
      socketRef.current?.close(NORMAL_CLOSE);
      socketRef.current = null;
    };
  }, [conversationId, enabled]);

  const send = useCallback((payload: unknown): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendMessage = useCallback((content: string) => send({ type: 'message', content }), [send]);
  const sendRead = useCallback(() => send({ type: 'read' }), [send]);
  const sendTyping = useCallback((started: boolean) => {
    send({ type: started ? 'typing.started' : 'typing.stopped' });
  }, [send]);

  return { connected, sendMessage, sendRead, sendTyping };
}
