import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LendingAdminController, LendingController, LendingPortalController } from './lending.controller';
import { LendingService } from './lending.service';
import { LateFeesService } from './late-fees.service';

@Module({
  imports: [PrismaModule],
  controllers: [LendingController, LendingPortalController, LendingAdminController],
  providers: [LendingService, LateFeesService],
})
export class LendingModule {}
