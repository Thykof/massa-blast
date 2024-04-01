import { Module } from '@nestjs/common';
import { BlasterService } from './blaster.service';
import { ClientModule } from '../client/client.module';
import { BlasterSchedulerService } from './blaster-scheduler';
import { RewardModule } from '../reward/reward.module';

@Module({
  imports: [ClientModule, RewardModule],
  providers: [BlasterService, BlasterSchedulerService],
})
export class BlasterModule {}
