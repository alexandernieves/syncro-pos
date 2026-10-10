import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { GymRemindersService } from './gym-reminders.service';
import { GymClassesService } from './gym-classes.service';
import { GymController } from './gym.controller';
import { GymPortalController } from './gym-portal.controller';
import { GymPortalService } from './gym-portal.service';
import { GymNotificationsService } from './gym-notifications.service';
import { GymStaffGuard, GymMemberGuard } from './gym-guards';
import { GymService } from './gym.service';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  controllers: [GymPortalController, GymController],
  providers: [GymService, GymRemindersService, GymClassesService, GymNotificationsService, GymPortalService, GymStaffGuard, GymMemberGuard],
  exports: [GymService],
})
export class GymModule {}
