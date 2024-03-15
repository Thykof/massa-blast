import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { RollService } from './roll.service';
import { DatabaseModule } from '../database/database.module';
@Module({
  imports: [HttpModule, DatabaseModule],
  providers: [RollService],
})
export class RollModule {}
