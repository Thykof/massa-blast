import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BlasterService } from './blaster.service';

@Injectable()
export class BlasterSchedulerService {
  constructor(private blasterService: BlasterService) {}

  public async onModuleInit(): Promise<void> {
    await this.blasterService.blast();
  }

  @Interval(10_000)
  async blasting() {
    this.blasterService.blast();
  }
}
