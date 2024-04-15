import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { BlasterService } from './blaster.service';

const CRON_NAME = 'cron_blaster';

@Injectable()
export class BlasterSchedulerService {
  private readonly logger = new Logger('BLASTER');

  constructor(
    private blasterService: BlasterService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: CRON_NAME,
  })
  async blasting() {
    const job = this.schedulerRegistry.getCronJob(CRON_NAME);
    job.stop();
    try {
      await this.blasterService.blast();
    } catch (error) {
      this.logger.error(error);
    }
    job.start();
  }
}
