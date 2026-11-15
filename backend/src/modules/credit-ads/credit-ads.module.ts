import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditAdsAdminController, CreditAdsPortalController } from './credit-ads.controller';
import { CreditAdsService } from './credit-ads.service';

@Module({
  imports: [PrismaModule],
  controllers: [CreditAdsAdminController, CreditAdsPortalController],
  providers: [CreditAdsService],
})
export class CreditAdsModule {}
