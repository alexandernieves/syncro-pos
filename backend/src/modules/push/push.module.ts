import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { PushCampaignsService } from './push-campaigns.service';
import { PushAdminController } from './push-admin.controller';

/** Push notifications from Syncro central and the automatic ones. Global so any module can fire an automation. */
@Global()
@Module({
  imports: [PrismaModule, ChatModule],
  controllers: [PushAdminController],
  providers: [PushCampaignsService],
  exports: [PushCampaignsService],
})
export class PushModule {}
