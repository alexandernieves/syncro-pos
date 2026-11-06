import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { SettingsModule } from '../settings/settings.module';
import { BusinessModulesController } from './business-modules.controller';
import { BusinessModulesService } from './business-modules.service';
import { ModuleRequestsService } from './module-requests.service';

@Module({
  imports: [PrismaModule, ChatModule, SettingsModule],
  controllers: [BusinessModulesController],
  providers: [BusinessModulesService, ModuleRequestsService],
  exports: [BusinessModulesService, ModuleRequestsService],
})
export class BusinessModulesModule {}
