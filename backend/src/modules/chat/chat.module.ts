import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { ChatDeliveryController } from './chat-delivery.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController, PushController, ChatDeliveryController],
  providers: [ChatService, ChatGateway, PushService],
  exports: [ChatService, PushService, ChatGateway],
})
export class ChatModule {}
