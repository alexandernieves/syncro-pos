import { FinanceNubiController } from './finance-nubi.controller';
import { FinanceNubiService } from './finance-nubi.service';
import { FinanceNubiAi } from './finance-nubi-ai';
import { FinanceNubiTransport } from './finance-nubi-transport';
import { FinanceGoogleCalendarService } from './finance-google-calendar.service';
import { CentralFinanceController } from './central-finance.controller';
import { SettingsModule } from '../settings/settings.module';
import { Module } from '@nestjs/common';
import { SyncroAdminService } from './syncro-admin.service';
import { SyncroAdminController } from './syncro-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModulesModule } from '../business-modules/business-modules.module';

@Module({
  imports: [PrismaModule, BusinessModulesModule, SettingsModule],
  controllers: [SyncroAdminController, CentralFinanceController, FinanceNubiController],
  providers: [SyncroAdminService, FinanceNubiService, FinanceNubiAi, FinanceNubiTransport, FinanceGoogleCalendarService],
  exports: [SyncroAdminService],
})
export class SyncroAdminModule {}
