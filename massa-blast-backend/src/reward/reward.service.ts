import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import BigNumber from 'bignumber.js';

const defaultPercentageFees = new BigNumber(10);

@Injectable()
export class RewardService {
  private readonly logger = new Logger('REWARDS');
  private nbCyclesFees = 3;
  private percentageFees = defaultPercentageFees;
  public readonly rollPrice = new BigNumber(100_000_000_000);
  constructor(private databaseService: DatabaseService) {
    this.nbCyclesFees = Number(process.env.NB_CYCLES_FEES) || 3;
    this.percentageFees =
      new BigNumber(process.env.PERCENT_FEES_ON_REWARDS ?? '10') ||
      defaultPercentageFees;
  }

  async getRewards(
    userAmount: bigint,
    fromDate: Date,
    toDate: Date,
  ): Promise<bigint> {
    // apply cycles fees: add cycles to the fromDate
    // 3 because stacking starts after 3 cycles
    // + this.nbCyclesFees because we want to take 3 cycles for us as fees
    fromDate = new Date(
      fromDate.getTime() + 16 * 128 * (3 + this.nbCyclesFees) * 1000,
    );

    const totalRewards = await this.getRewardsWithoutFees(
      new BigNumber(userAmount.toString()),
      fromDate,
      toDate,
    );

    this.logger.log('Total rewards: ' + totalRewards.toFixed(0));

    const fees = this.calculateFees(totalRewards);

    this.logger.log('Fees: ' + fees.toFixed(0));

    const toDistribute = BigInt(totalRewards.minus(fees).toFixed(0));

    this.logger.log('To distribute: ' + toDistribute);

    return toDistribute;
  }

  async getRewardsWithoutFees(
    userAmount: BigNumber,
    fromDate: Date,
    toDate: Date,
  ): Promise<BigNumber> {
    const totalRollsRecords = await this.databaseService.getTotalRolls(
      fromDate,
      toDate,
    );

    const initialUserAmount = userAmount;
    let compoundTimes = new BigNumber(0);

    let totalRewards = new BigNumber(0);

    for (let i = 0; i <= totalRollsRecords.length - 2; i++) {
      const rewards = this.rewardsDuringPeriod(
        totalRollsRecords[i].value,
        totalRollsRecords[i + 1].value,
        totalRollsRecords[i].createdAt,
        totalRollsRecords[i + 1].createdAt,
        userAmount,
      );

      // if the user amount is enough to compound, we compound
      const newUserAmount = initialUserAmount.plus(totalRewards);
      if (
        newUserAmount.isGreaterThan(this.rollPrice.multipliedBy(compoundTimes))
      ) {
        userAmount = newUserAmount;
        compoundTimes = compoundTimes.plus(1);
      }

      totalRewards = totalRewards.plus(rewards);
    }

    return totalRewards;
  }

  rewardsDuringPeriod(
    totalRollsStart: number,
    totalRollsEnd: number,
    periodStart: Date,
    periodEnd: Date,
    userAmount: BigNumber,
  ): BigNumber {
    const averageRolls = this.averageRolls(
      // toFixed to avoid floating point issues, roll number should be an integer
      new BigNumber(totalRollsStart.toFixed(0)),
      new BigNumber(totalRollsEnd.toFixed(0)),
    );

    const rewardsPerDay = this.rewardsPerRoll(averageRolls, userAmount);
    const rewardsPerHour = rewardsPerDay.dividedBy(24);
    const rewardsPerMinute = rewardsPerHour.dividedBy(60);
    const rewardsPerSecond = rewardsPerMinute.dividedBy(60);

    const difference = periodEnd.getTime() - periodStart.getTime(); // in milliseconds

    return rewardsPerSecond.multipliedBy(difference).dividedBy(1000);
  }

  rewardsPerRoll(totalRolls: BigNumber, userAmount: BigNumber): BigNumber {
    const totalMAS = new BigNumber(172_800_000_000_000);
    const productionRate = userAmount.dividedBy(
      totalRolls.multipliedBy(this.rollPrice),
    );

    const rewardsPerBlock = totalMAS
      .multipliedBy(productionRate)
      .multipliedBy(0.7);
    const rewardsPerEndorsement = totalMAS
      .multipliedBy(16)
      .multipliedBy(productionRate)
      .multipliedBy(0.02);

    return rewardsPerBlock.plus(rewardsPerEndorsement);
  }

  averageRolls(
    totalRollsStart: BigNumber,
    totalRollsEnd: BigNumber,
  ): BigNumber {
    return totalRollsStart.plus(totalRollsEnd).dividedBy(2);
  }

  calculateFees(rewards: BigNumber): BigNumber {
    return rewards.multipliedBy(this.percentageFees).dividedBy(100);
  }
}
