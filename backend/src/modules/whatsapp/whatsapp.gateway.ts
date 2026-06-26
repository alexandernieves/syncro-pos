import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * WhatsApp WebSocket Gateway with multi-tenant isolation.
 *
 * Each business's connected clients join a dedicated Socket.IO room
 * named "whatsapp:{businessId}". All events are emitted only to that
 * room so one business NEVER receives real-time events from another.
 *
 * Frontend must emit 'joinBusiness' with { businessId } immediately
 * after connecting.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WhatsAppGateway {
  @WebSocketServer()
  server: Server;

  /** Client joins a business-specific room for isolated event delivery. */
  @SubscribeMessage('joinBusiness')
  handleJoinBusiness(
    @MessageBody() data: { businessId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.businessId) {
      const room = `whatsapp:${data.businessId}`;
      client.join(room);
    }
  }

  /** Emit a new message only to the business that owns the chat. */
  emitNewMessage(message: any) {
    if (!this.server) return;
    const businessId = message?.businessId;
    if (businessId) {
      this.server.to(`whatsapp:${businessId}`).emit('whatsapp_newMessage', message);
    } else {
      // Fallback for messages without businessId (should not happen after migration)
      this.server.emit('whatsapp_newMessage', message);
    }
  }

  /** Emit a chat update only to the business that owns the chat. */
  emitChatUpdated(chat: any) {
    if (!this.server) return;
    const businessId = chat?.businessId;
    if (businessId) {
      this.server.to(`whatsapp:${businessId}`).emit('whatsapp_chatUpdated', chat);
    } else {
      this.server.emit('whatsapp_chatUpdated', chat);
    }
  }

  /** Emit a chat deletion only to the business that owned the chat. */
  emitChatDeleted(chatId: string, businessId?: string) {
    if (!this.server) return;
    if (businessId) {
      this.server.to(`whatsapp:${businessId}`).emit('whatsapp_chatDeleted', { id: chatId });
    } else {
      this.server.emit('whatsapp_chatDeleted', { id: chatId });
    }
  }

  /** Emit a message status update only to the business that owns the message. */
  emitMessageStatusUpdated(data: { messageId: string; chatId: string; status: string; businessId?: string }) {
    if (!this.server) return;
    if (data.businessId) {
      this.server.to(`whatsapp:${data.businessId}`).emit('whatsapp_messageStatusUpdated', data);
    } else {
      this.server.emit('whatsapp_messageStatusUpdated', data);
    }
  }
}
