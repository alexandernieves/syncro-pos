import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { BcvService } from './bcv.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, BcvService],
  exports: [SettingsService, BcvService],
})
export class SettingsModule {}
