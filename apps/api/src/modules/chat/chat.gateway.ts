import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { AccessTokenPayload, AuthUserContext } from '../../common/auth-user.js';
import { env } from '../../config/env.js';
import { ChatRealtime, userRoom } from './chat.realtime.js';
import { ChatService } from './chat.service.js';

type ChatSocket = Socket & { data: { user?: AuthUserContext; typingAt?: number } };

const TYPING_THROTTLE_MS = 1_500;

/**
 * Real-time channel for chat (`/chat` namespace). Clients authenticate with their access token in
 * `handshake.auth.token`; sending messages still goes through the REST API, which then pushes the
 * events here. The only client → server event is the typing indicator.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: ChatRealtime,
    private readonly chat: ChatService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attach(server);
  }

  async handleConnection(client: ChatSocket) {
    const token: unknown = client.handshake.auth?.token;
    try {
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: env.JWT_ACCESS_SECRET });
      client.data.user = { id: payload.sub, role: payload.role };
      await client.join(userRoom(payload.sub));
    } catch {
      // Expired or missing token: the client refreshes its session and reconnects with a new one.
      client.emit('chat:unauthorized');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chat:typing')
  async typing(@ConnectedSocket() client: ChatSocket, @MessageBody() body: unknown) {
    const user = client.data.user;
    const conversationId = typeof body === 'object' && body && 'conversationId' in body ? (body as { conversationId: unknown }).conversationId : null;
    if (!user || typeof conversationId !== 'string') return;
    const now = Date.now();
    if (client.data.typingAt && now - client.data.typingAt < TYPING_THROTTLE_MS) return;
    client.data.typingAt = now;
    try {
      const { side, otherUserIds } = await this.chat.participants(user, conversationId);
      this.realtime.emit(otherUserIds, 'chat:typing', { conversationId, side });
    } catch (e) {
      // Not a participant (or the thread is gone): ignore quietly, typing is best-effort.
      this.logger.debug(`typing ignored: ${(e as Error).message}`);
    }
  }
}
