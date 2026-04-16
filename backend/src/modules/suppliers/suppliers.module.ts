import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersAlertsService } from './suppliers-alerts.service';
import { SuppliersController } from './suppliers.controller';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersAlertsService],
  exports: [SuppliersService, SuppliersAlertsService],
})
export class SuppliersModule {}
