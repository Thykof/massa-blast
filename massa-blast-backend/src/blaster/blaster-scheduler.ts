import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BlasterService } from './blaster.service';

@Injectable()
export class BlasterSchedulerService {
  constructor(private blasterService: BlasterService) {}

  public async onModuleInit(): Promise<void> {
    await this.blasterService.blast();
  }

  @Interval(3 * 60 * 1000) // every 3 minutes to wait for finality of the previous operations
  // @Interval(10000) // DEBUG
  async blasting() {
    this.blasterService.blast();
  }
}
