import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DatabaseService {
  constructor() {}

  private readonly logger = new Logger('DB');

  @Cron(CronExpression.EVERY_10_SECONDS)
  fetchAndSaveTotalRolls() {
    this.logger.log('Fetching and saving total rolls');
  }
}
