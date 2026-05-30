import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { EmbeddingsService } from './embeddings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, ChatModule],
  controllers: [AiAgentController],
  providers: [AiAgentService, EmbeddingsService],
  exports: [AiAgentService],
})
export class AiAgentModule {}
