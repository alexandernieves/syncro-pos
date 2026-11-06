import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MascotController } from './mascot.controller';
import { MascotService } from './mascot.service';

@Module({
  imports: [PrismaModule],
  controllers: [MascotController],
  providers: [MascotService],
})
export class MascotModule {}
