import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ClientService } from '../client/client.service';
import { BlastingSession } from '../client/types/BlastingSession';

interface DistributeResult {
  remainingBalance: bigint;
  remainingToDistribute: bigint;
}

export const rollValue = 100_000_000_000n;

@Injectable()
export class BlasterService {
  private readonly logger = new Logger('BLASTER');
  private readonly nodeAddress = process.env.NODE_ADDRESS;

  constructor(private clientService: ClientService) {}

  @Interval(10_000)
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
    const pendingWithdrawAmount = sessions.reduce(
      (acc, curr) => acc + curr.amount,
      0n,
    );
    this.logger.log('Pending withdraw amount:', pendingWithdrawAmount);

    const balance = await this.clientService.getBalance(this.nodeAddress);
    this.logger.log('Balance:', balance);

    // sort to distribute first the oldest sessions
    const sortedSessions = sessions.sort((a, b) => {
      if (a.startTimestamp > b.startTimestamp) {
        return 1;
      } else if (a.startTimestamp < b.startTimestamp) {
        return -1;
      } else {
        return 0;
      }
    });

    let remainingBalance = balance;
    let remainingToDistribute = pendingWithdrawAmount;

    for (const session of sortedSessions) {
      if (remainingBalance < session.amount) {
        this.logger.log('Not enough balance to distribute');
        break;
      }

      this.logger.log(
        `setWithdrawableFor ${session.amount} to ${session.userAddress}`,
      );
      await this.clientService.setWithdrawableFor(
        session.userAddress,
        session.withdrawRequestOpId,
        session.amount,
      );
      remainingBalance -= session.amount;
      remainingToDistribute -= session.amount;
    }

    this.logger.log('Remaining balance:', remainingBalance);
    this.logger.log('Remaining to distribute:', remainingToDistribute);

    return {
      remainingBalance,
      remainingToDistribute,
    };
  }

  private async sellOrBuyRolls(
    distributeResult: DistributeResult,
  ): Promise<void> {
    const { remainingBalance, remainingToDistribute } = distributeResult;
    // 3. Sum up the deferred credit
    const deferredCredit = await this.clientService.getAllDeferredCredits(
      this.nodeAddress,
    );
    this.logger.log('Deferred credit:', deferredCredit);

    const totalFutureBalance = remainingBalance + deferredCredit;
    this.logger.log('Total future balance:', totalFutureBalance);

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
    const rollAmount = this.howManyRollsToSell(
      totalFutureBalance,
      remainingToDistribute,
    );
    this.logger.log('Selling', rollAmount, 'rolls');
    await this.clientService.sellRolls(rollAmount);
  }

  private async buyRolls(remainingBalance: bigint) {
    const rollAmount = remainingBalance / rollValue;
    this.logger.log('Buying', rollAmount, 'rolls');
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
