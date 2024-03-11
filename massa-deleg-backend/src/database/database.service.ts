import { Injectable, Logger } from '@nestjs/common';
import { TotalRollsRecord } from './entities/TotalRollsRecord';
import { MongoRepository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(TotalRollsRecord)
    public repo: MongoRepository<TotalRollsRecord>,
  ) {}

  private readonly logger = new Logger('DB');

  async addTotalRolls(totalRolls: number) {
    const totalRollsRecord = new TotalRollsRecord();
    totalRollsRecord.value = totalRolls;
    totalRollsRecord.createdAt = new Date(); // TODO: get the date just after making the request, and pass it as a parameter

    await totalRollsRecord.save();
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  fetchAndSaveTotalRolls() {
    this.logger.log('Fetching and saving total rolls');
  }
}
