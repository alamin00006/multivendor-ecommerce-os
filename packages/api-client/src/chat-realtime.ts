import type { ChatMessageView, ChatSide } from '@marketbd/shared';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io, type Socket } from 'socket.io-client';
import { type RootStateWithAuth, selectAuth } from './auth-slice.js';
import { chatApi } from './endpoints/chat.js';

interface ServerEvents {
  'chat:message': (payload: { conversationId: string; message: ChatMessageView }) => void;
  'chat:read': (payload: { conversationId: string; side: ChatSide; at: string }) => void;
  'chat:typing': (payload: { conversationId: string; side: ChatSide }) => void;
  'chat:unauthorized': () => void;
}
interface ClientEvents {
  'chat:typing': (payload: { conversationId: string }) => void;
}

/** How long "typing…" stays visible after the last typing event. */
const TYPING_VISIBLE_MS = 3_000;

// One connection per app, shared by every screen through the small stores below.
let socket: Socket<ServerEvents, ClientEvents> | null = null;
let live = false;
const liveListeners = new Set<() => void>();
const typingUntil = new Map<string, number>();
const typingListeners = new Set<() => void>();

const setLive = (value: boolean) => {
  if (live === value) return;
  live = value;
  liveListeners.forEach((fn) => fn());
};
const notifyTyping = () => typingListeners.forEach((fn) => fn());

/** True while the Socket.IO channel is connected; screens then stop polling. */
export const useChatLive = () =>
  useSyncExternalStore(
    (fn) => {
      liveListeners.add(fn);
      return () => liveListeners.delete(fn);
    },
    () => live,
    () => false,
  );

/** True while the other side of this conversation is typing. */
export const useChatTyping = (conversationId: string) =>
  useSyncExternalStore(
    (fn) => {
      typingListeners.add(fn);
      return () => typingListeners.delete(fn);
    },
    () => (typingUntil.get(conversationId) ?? 0) > Date.now(),
    () => false,
  );

/** Tells the other side we are typing (the server throttles it). */
export const sendChatTyping = (conversationId: string) => {
  if (socket?.connected) socket.emit('chat:typing', { conversationId });
};

/**
 * Connects to the API's `/chat` Socket.IO namespace while signed in and keeps chat data fresh:
 * every pushed message or read receipt refetches the chat queries (threads, inbox, unread badges).
 * Mount once near the root. `origin` is the API origin, e.g. `http://localhost:4000`.
 */
export function useChatRealtime(origin: string | null | undefined) {
  const dispatch = useDispatch();
  const { status, accessToken } = useSelector((s: RootStateWithAuth) => selectAuth(s));
  const token = useRef(accessToken);

  useEffect(() => {
    token.current = accessToken;
    // The server drops sockets whose token expired; reconnect once the session has a fresh one.
    if (accessToken && socket && !socket.connected) socket.connect();
  }, [accessToken]);

  useEffect(() => {
    if (!origin || status !== 'authenticated') return;
    const s: Socket<ServerEvents, ClientEvents> = io(`${origin.replace(/\/$/, '')}/chat`, {
      // Read on every (re)connect so a refreshed token is used.
      auth: (cb) => cb({ token: token.current }),
      transports: ['websocket'],
    });
    socket = s;
    const refresh = () => dispatch(chatApi.util.invalidateTags(['Chat']));

    s.on('connect', () => {
      setLive(true);
      // Catch up on anything missed while disconnected.
      refresh();
    });
    s.on('disconnect', () => setLive(false));
    s.on('connect_error', () => setLive(false));
    s.on('chat:unauthorized', () => setLive(false));
    s.on('chat:message', ({ conversationId }) => {
      typingUntil.delete(conversationId);
      notifyTyping();
      refresh();
    });
    s.on('chat:read', refresh);
    s.on('chat:typing', ({ conversationId }) => {
      typingUntil.set(conversationId, Date.now() + TYPING_VISIBLE_MS);
      notifyTyping();
      setTimeout(notifyTyping, TYPING_VISIBLE_MS + 50);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      if (socket === s) socket = null;
      setLive(false);
    };
  }, [origin, status, dispatch]);
}
