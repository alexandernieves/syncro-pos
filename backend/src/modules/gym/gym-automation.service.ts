import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GymService } from './gym.service';
import { GymEquipmentService } from './gym-equipment.service';

/** Background jobs of the gym that don't send messages: scheduled freezes and preventive services. */
@Injectable()
export class GymAutomationService {
  private readonly logger = new Logger('GymAutomation');
  private running = false;

  constructor(
    private gym: GymService,
    private equipment: GymEquipmentService,
  ) {}

  @Cron('30 */10 * * * *')
  async freezes() {
    if (this.running) return;
    this.running = true;
    try {
      const r = await this.gym.runScheduledFreezes();
      if (r.started || r.ended) this.logger.log(`Freezes: ${r.started} started, ${r.ended} ended`);
      const opened = await this.equipment.openDueServices();
      if (opened) this.logger.log(`Preventive services opened: ${opened}`);
    } catch (e) {
      this.logger.warn(`Scheduled freezes skipped: ${String(e.message).split('\n').filter(Boolean).pop()}`);
    } finally {
      this.running = false;
    }
  }
}
