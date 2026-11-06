import { Module } from '@nestjs/common';
import { SyncroAdminService } from './syncro-admin.service';
import { SyncroAdminController } from './syncro-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModulesModule } from '../business-modules/business-modules.module';

@Module({
  imports: [PrismaModule, BusinessModulesModule],
  controllers: [SyncroAdminController],
  providers: [SyncroAdminService],
  exports: [SyncroAdminService],
})
export class SyncroAdminModule {}
