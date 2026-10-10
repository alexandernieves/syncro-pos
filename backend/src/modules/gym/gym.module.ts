import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { GymRemindersService } from './gym-reminders.service';
import { GymClassesService } from './gym-classes.service';
import { GymController } from './gym.controller';
import { GymService } from './gym.service';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  controllers: [GymController],
  providers: [GymService, GymRemindersService, GymClassesService],
  exports: [GymService],
})
export class GymModule {}
