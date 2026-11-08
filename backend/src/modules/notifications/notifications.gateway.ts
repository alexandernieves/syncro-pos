import {
  WebSocketGateway,
  WebSocketServer,
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
        // The business's team only: its customers (portal) don't hear internal notices
        if (decoded && decoded.businessId && decoded.role !== 'client') {
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

  // No "join any room" message: a socket only ever hears its own business (joined above from the
  // verified token), so nobody can listen to another business's notifications.
}
