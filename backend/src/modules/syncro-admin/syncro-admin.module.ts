import { Module } from '@nestjs/common';
import { SyncroAdminService } from './syncro-admin.service';
import { SyncroAdminController } from './syncro-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncroAdminController],
  providers: [SyncroAdminService],
  exports: [SyncroAdminService],
})
export class SyncroAdminModule {}
