import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RewardService {
  constructor(private databaseService: DatabaseService) {}

  async getRewards(
    userAmount: bigint,
    fromDate: Date,
    toDate: Date,
  ): Promise<bigint> {
    const totalRollsRecords = await this.databaseService.getTotalRolls(
      fromDate,
      toDate,
    );

    let totalRewards = 0n;

    for (let i = 0; i <= totalRollsRecords.length - 2; i++) {
      totalRewards += this.rewardsDuringPeriod(
        BigInt(totalRollsRecords[i].value),
        BigInt(totalRollsRecords[i + 1].value),
        totalRollsRecords[i].createdAt,
        totalRollsRecords[i + 1].createdAt,
        userAmount,
      );
    }

    return totalRewards;
  }

  rewardsDuringPeriod(
    totalRollsStart: bigint,
    totalRollsEnd: bigint,
    periodStart: Date,
    periodEnd: Date,
    userAmount: bigint,
  ): bigint {
    const averageRolls = (totalRollsStart + totalRollsEnd) / 2n;

    const rewardsPerDay = this.rewardsPerRoll(averageRolls, userAmount);
    const rewardsPerHour = rewardsPerDay / 24n;
    const rewardsPerMinute = rewardsPerHour / 60n;
    const rewardsPerSecond = rewardsPerMinute / 60n;

    const difference =
      BigInt(periodEnd.getTime()) - BigInt(periodStart.getTime()); // in milliseconds

    return (rewardsPerSecond * difference) / 1000n;
  }

  private rewardsPerRoll(totalRolls: bigint, userAmount: bigint): bigint {
    const totalMAS = 172_800_000_000_000n;
    const productionRate = userAmount / 100n / totalRolls;

    const rewardsPerBlock = (totalMAS * productionRate * 7n) / 10n;
    const rewardsPerEndorsement = (totalMAS * 16n * productionRate * 2n) / 100n;

    return rewardsPerBlock + rewardsPerEndorsement;
  }
}
