import { Injectable } from '@nestjs/common';
import type { ChatMessageView, ChatSide } from '@marketbd/shared';
import type { Namespace } from 'socket.io';

/** Socket.IO events pushed to clients on the `/chat` namespace. */
export interface ChatServerEvents {
  'chat:message': (payload: { conversationId: string; message: ChatMessageView }) => void;
  'chat:read': (payload: { conversationId: string; side: ChatSide; at: string }) => void;
  'chat:typing': (payload: { conversationId: string; side: ChatSide }) => void;
}

export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Pushes chat events to connected clients. Every socket joins its user's room on connect,
 * so events address people, not sockets (several tabs or devices all receive them).
 * Kept apart from the gateway so the chat service can emit without a circular dependency.
 */
@Injectable()
export class ChatRealtime {
  private server: Namespace | null = null;

  attach(server: Namespace) {
    this.server = server;
  }

  emit<E extends keyof ChatServerEvents>(userIds: string[], event: E, ...args: Parameters<ChatServerEvents[E]>) {
    if (!this.server || !userIds.length) return;
    this.server.to([...new Set(userIds)].map(userRoom)).emit(event, ...args);
  }
}
