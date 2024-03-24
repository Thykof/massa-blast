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
    // TODO: to improve createAt accuracy we can get the date just after making the request, and pass it as a parameter
    totalRollsRecord.createdAt = new Date();

    await totalRollsRecord.save();
  }

  async getTotalRolls(
    fromDate: Date,
    toDate: Date,
  ): Promise<TotalRollsRecord[]> {
    return await this.repo.find({
      where: {
        createdAt: {
          $gte: fromDate,
          $lt: toDate,
        },
      },
    });
  }
}
