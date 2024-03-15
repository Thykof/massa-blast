import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RewardService {
  constructor(private databaseService: DatabaseService) {}

  async getRewards(
    userRolls: number,
    fromDate: Date,
    toDate: Date,
  ): Promise<number> {
    const totalRollsRecords = await this.databaseService.getTotalRolls(
      fromDate,
      toDate,
    );

    let totalRewards = 0;

    for (let i = 0; i < totalRollsRecords.length - 2; i++) {
      const totalRollsStart = totalRollsRecords[i].value;
      const totalRollsEnd = totalRollsRecords[i + 1].value;

      const rewards = this.rewardsDuringPeriod(
        totalRollsStart,
        totalRollsEnd,
        totalRollsRecords[i].createdAt,
        totalRollsRecords[i + 1].createdAt,
        userRolls,
      );

      totalRewards += rewards;
    }

    return totalRewards;
  }

  rewardsDuringPeriod(
    totalRollsStart: number,
    totalRollsEnd: number,
    periodStart: Date,
    periodEnd: Date,
    userRolls: number,
  ): number {
    const averageRolls = (totalRollsStart + totalRollsEnd) / 2;

    const rewardsPerDay = this.rewardsPerRoll(averageRolls, userRolls);
    const rewardsPerHour = rewardsPerDay / 24;
    const rewardsPerMinute = rewardsPerHour / 60;
    const rewardsPerSecond = rewardsPerMinute / 60;

    const difference = periodEnd.getTime() - periodStart.getTime(); // in milliseconds

    return (rewardsPerSecond * difference) / 1000;
  }

  private rewardsPerRoll(totalRolls: number, userRolls: number): number {
    const totalMAS = 172800;
    const productionRate = userRolls / totalRolls;

    const rewardsPerBlock = totalMAS * productionRate * 0.7;
    const rewardsPerEndorsement = totalMAS * 16 * productionRate * 0.02;

    return rewardsPerBlock + rewardsPerEndorsement;
  }
}
