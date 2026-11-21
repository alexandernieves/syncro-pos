import { CentralFinanceController } from './central-finance.controller';
import { SettingsModule } from '../settings/settings.module';
import { Module } from '@nestjs/common';
import { SyncroAdminService } from './syncro-admin.service';
import { SyncroAdminController } from './syncro-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModulesModule } from '../business-modules/business-modules.module';

@Module({
  imports: [PrismaModule, BusinessModulesModule, SettingsModule],
  controllers: [SyncroAdminController, CentralFinanceController],
  providers: [SyncroAdminService],
  exports: [SyncroAdminService],
})
export class SyncroAdminModule {}
