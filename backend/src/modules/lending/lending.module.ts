import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LendingController, LendingPortalController } from './lending.controller';
import { LendingService } from './lending.service';

@Module({
  imports: [PrismaModule],
  controllers: [LendingController, LendingPortalController],
  providers: [LendingService],
})
export class LendingModule {}
