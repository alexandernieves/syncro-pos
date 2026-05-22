import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to your frontend URL
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('NotificationsGateway');

  handleConnection(client: Socket) {
    let token = client.handshake.auth?.token;
    if (token) {
      if (token.startsWith('Bearer ')) {
        token = token.slice(7);
      }
      try {
        const secret = process.env.JWT_SECRET || 'syncro-pos-secret-key-2025';
        const decoded = jwt.verify(token, secret) as any;
        if (decoded && decoded.businessId) {
          client.join(decoded.businessId);
          this.logger.log(`Client ${client.id} joined business room: ${decoded.businessId}`);
        }
      } catch (err: any) {
        this.logger.error(`Error authenticating socket client ${client.id}: ${err.message}`);
      }
    } else {
      this.logger.warn(`Client connected without token: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Example: Client joining a specific room (e.g., their branch or user ID)
  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }
}
