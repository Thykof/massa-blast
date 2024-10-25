import { Injectable, Logger } from '@nestjs/common';
import { ClientService } from '../client/client.service';
import { BlastingSession } from '../client/types/BlastingSession';
import { RewardService } from '../reward/reward.service';

interface DistributeResult {
  remainingBalance: bigint;
  remainingToDistribute: bigint;
}

export const rollValue = 100_000_000_000n;

@Injectable()
export class BlasterService {
  private readonly logger = new Logger('BLASTER');
  private readonly nodeAddress = process.env.NODE_ADDRESS;

  constructor(
    private clientService: ClientService,
    private rewardService: RewardService,
  ) {}

  async blast() {
    this.logger.log('Blasting...');
    // 1. Sum up all the pending withdraw requests
    const sessions =
      await this.clientService.getBlastingSessionsOfPendingWithdrawRequests();
    // 2. Send the amount with sitWithdrawableFor with the available balance
    const distributeResult = await this.distribute(sessions);
    await this.sellOrBuyRolls(distributeResult);
  }

  private async distribute(
    sessions: BlastingSession[],
  ): Promise<DistributeResult> {
    const pendingWithdrawAmount = await sessions.reduce(async (acc, curr) => {
      return (
        (await acc) +
        curr.amount +
        (await this.rewardService.getRewards(
          curr.amount,
          new Date(Number(curr.startTimestamp)),
          new Date(Number(curr.endTimestamp)),
        ))
      );
    }, Promise.resolve(0n));
    this.logger.log(`Pending withdraw amount: ${pendingWithdrawAmount}`);

    const balance = await this.clientService.getBalance(this.nodeAddress);
    this.logger.log(`Balance: ${balance}`);

    // sort to distribute first the most recent withdraw request sessions
    const sortedSessions = sessions.sort((a, b) => {
      if (a.endTimestamp < b.endTimestamp) {
        return 1;
      } else if (a.endTimestamp > b.endTimestamp) {
        return -1;
      } else {
        return 0;
      }
    });

    let remainingBalance = balance;
    let remainingToDistribute = pendingWithdrawAmount;

    for (const session of sortedSessions) {
      // TODO: refactor to not call getRewards twice
      const rewards = await this.rewardService.getRewards(
        session.amount,
        new Date(Number(session.startTimestamp)),
        new Date(Number(session.endTimestamp)),
      );

      const amountToDistribute = session.amount + rewards;

      if (remainingBalance < amountToDistribute) {
        this.logger.log('Not enough balance to distribute');
        break;
      }

      await this.setWithdrawableFor(session, amountToDistribute);
      remainingBalance -= amountToDistribute;
      remainingToDistribute -= amountToDistribute;
    }

    this.logger.log('Distribute done');
    this.logger.log(`Remaining balance: ${remainingBalance}`);
    this.logger.log(`Remaining to distribute: ${remainingToDistribute}`);

    return {
      remainingBalance,
      remainingToDistribute,
    };
  }

  public async setWithdrawableFor(
    session: BlastingSession,
    amountToDistribute: bigint,
  ) {
    this.logger.log(
      `Setting withdrawable ${amountToDistribute} for ${session.userAddress}`,
    );
    await this.clientService.setWithdrawableFor(
      session.userAddress,
      session.withdrawRequestOpId,
      amountToDistribute,
    );
  }

  private async sellOrBuyRolls(
    distributeResult: DistributeResult,
  ): Promise<void> {
    const { remainingBalance, remainingToDistribute } = distributeResult;
    // 3. Sum up the deferred credit
    const deferredCredit = await this.clientService.getAllDeferredCredits(
      this.nodeAddress,
    );
    this.logger.log(`Deferred credit: ${deferredCredit}`);

    const totalFutureBalance = remainingBalance + deferredCredit;
    this.logger.log(`Total future balance: ${totalFutureBalance}`);

    // 4. Is sum of deferred credit is bellow sum of remaining amount to distribute, sell rolls
    if (totalFutureBalance < remainingToDistribute) {
      await this.sellRolls(totalFutureBalance, remainingToDistribute);
      return;
    }

    if (remainingBalance >= rollValue && remainingToDistribute === 0n) {
      // 5. If balance is over 100 MAS and no withdraw request: buy rolls
      await this.buyRolls(remainingBalance);
    }
  }

  private async sellRolls(
    totalFutureBalance: bigint,
    remainingToDistribute: bigint,
  ) {
    // TODO: don't sell if the roll amount is 1, we need always 1 roll at least
    const rollAmount = this.howManyRollsToSell(
      totalFutureBalance,
      remainingToDistribute,
    );
    this.logger.log(`Selling ${rollAmount} roll(s)`);
    await this.clientService.sellRolls(rollAmount);
  }

  private async buyRolls(remainingBalance: bigint) {
    const rollAmount = remainingBalance / rollValue;
    this.logger.log(`Buying ${rollAmount} roll(s)`);
    await this.clientService.buyRolls(rollAmount);
  }

  public howManyRollsToSell(
    totalFutureBalance: bigint,
    remainingToDistribute: bigint,
  ) {
    const missingAmount = remainingToDistribute - totalFutureBalance;
    if (missingAmount % rollValue === 0n) {
      return missingAmount / rollValue;
    }
    return missingAmount / rollValue + 1n;
  }
}
