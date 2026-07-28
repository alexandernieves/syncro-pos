import { Module } from '@nestjs/common';
import { LandingsController } from './landings.controller';
import { LandingsService } from './landings.service';
import { ScraperService } from './scraper.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LandingsController],
  providers: [LandingsService, ScraperService],
  exports: [LandingsService],
})
export class LandingsModule {}
