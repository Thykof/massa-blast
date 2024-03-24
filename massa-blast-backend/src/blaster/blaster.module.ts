import { Module } from '@nestjs/common';
import { BlasterService } from './blaster.service';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [ClientModule],
  providers: [BlasterService],
})
export class BlasterModule {}
