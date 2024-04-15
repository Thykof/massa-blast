import {
  Args,
  Client,
  EOperationStatus,
  fromMAS,
  IAddressInfo,
  MAX_GAS_CALL,
  ProviderType,
  PublicApiClient,
  WalletClient,
  Web3Account,
} from '@massalabs/massa-web3';
import { Injectable, Logger } from '@nestjs/common';
import { BlastingSession } from './types/BlastingSession';

const EXPIRY_PERIOD = 9;

@Injectable()
export class ClientService {
  private readonly logger = new Logger('CLIENT');
  public client: Client;
  public blastContract: string = process.env.ADDRESS_CONTRACT;
  private defaultFees = 1000n;

  public async onModuleInit(): Promise<void> {
    const adminAccount = await WalletClient.getAccountFromSecretKey(
      process.env.NODE_PK,
    );

    const clientConfig = {
      retryStrategyOn: true,
      providers: [
        { url: process.env.MASSA_JSON_RPC, type: ProviderType.PUBLIC },
      ],
      periodOffset: EXPIRY_PERIOD,
    };
    const publicApi = new PublicApiClient(clientConfig);

    const status = await publicApi.getNodeStatus();
    this.logger.log(
      `Connected to Massa RPC! version: ${status.version}, chainId: ${status.chain_id}`,
    );

    const account = new Web3Account(
      adminAccount,
      publicApi,
      BigInt(status.chain_id),
    );

    this.client = new Client(clientConfig, account, publicApi);

    const envDefaultFees = process.env.DEFAULT_FEES;
    if (envDefaultFees) {
      this.defaultFees = BigInt(envDefaultFees);
    }
  }

  public async getBalance(address: string): Promise<bigint> {
    const res = await this.getAddress(address);
    if (!res) {
      this.logger.error(`Address ${address} not found`);
      return 0n;
    }

    return fromMAS(res.final_balance);
  }

  public async getAllDeferredCredits(address: string): Promise<bigint> {
    const res = await this.getAddress(address);
    if (!res) {
      return 0n;
    }

    return res.deferred_credits.reduce(
      (acc, curr) => acc + fromMAS(curr.amount),
      0n,
    );
  }

  public async getBlastingSessionsOfPendingWithdrawRequests(): Promise<
    BlastingSession[]
  > {
    const res = await this.client.smartContracts().readSmartContract({
      maxGas: MAX_GAS_CALL,
      targetAddress: this.blastContract,
      targetFunction: 'getBlastingSessionsOfPendingWithdrawRequests',
      parameter: [],
    });

    const args = new Args(res.returnValue);
    if (args.serialize().length === 0) {
      // TODO: args.serialize() should contains at least the length of the array, u32
      // maybe there is a bug...
      return [];
    }
    return args.nextSerializableObjectArray<BlastingSession>(BlastingSession);
  }

  public async setWithdrawableFor(
    userAddress: string,
    operationId: string,
    amount: bigint,
  ): Promise<void> {
    const callData = {
      fee: this.defaultFees,
      coins: amount + fromMAS(0.007_800_000),
      targetAddress: this.blastContract,
      targetFunction: 'setWithdrawableFor',
      parameter: new Args()
        .addString(userAddress)
        .addString(operationId)
        .addU64(amount),
    };
    const readOnlyEstimation = await this.client
      .smartContracts()
      .readSmartContract(callData);

    let maxGas = BigInt(Math.floor(readOnlyEstimation.info.gas_cost * 1.2));
    maxGas = maxGas > MAX_GAS_CALL ? MAX_GAS_CALL : maxGas;
    const opId = await this.client
      .smartContracts()
      .callSmartContract({ ...callData, maxGas });
    this.logger.log(`setWithdrawableFor operation ID: ${opId}`);
    await this.waitOperation(opId);
  }

  public async sellRolls(rollAmount: bigint): Promise<void> {
    const opIds = await this.client.wallet().sellRolls({
      fee: this.defaultFees,
      amount: rollAmount,
    });
    const opId = opIds[0];
    this.logger.log(`sellRolls operation ID: ${opId}`);
    await this.waitOperation(opId);
  }

  public async buyRolls(rollAmount: bigint): Promise<void> {
    const opIds = await this.client.wallet().buyRolls({
      fee: this.defaultFees,
      amount: rollAmount,
    });
    const opId = opIds[0];
    this.logger.log(`buyRolls operation ID: ${opId}`);
    await this.waitOperation(opId);
  }

  private async getAddress(address: string): Promise<IAddressInfo | undefined> {
    const res = await this.client.publicApi().getAddresses([address]);
    if (res.length === 0) {
      this.logger.error(`Address ${address} not found`);
      return undefined;
    }
    return res[0];
  }

  private async waitOperation(operationId: string): Promise<void> {
    let status: EOperationStatus;
    try {
      status = await this.client
        .smartContracts()
        .awaitMultipleRequiredOperationStatus(
          operationId,
          [
            EOperationStatus.SPECULATIVE_ERROR,
            EOperationStatus.FINAL_ERROR,
            EOperationStatus.FINAL_SUCCESS,
          ],
          180_000,
        );
    } catch (error) {
      this.logger.error(`Operation ${operationId} error ${error}`);
    }

    if (
      [
        EOperationStatus.FINAL_ERROR,
        EOperationStatus.SPECULATIVE_ERROR,
      ].includes(status)
    ) {
      this.logger.error(`Operation ${operationId} failed`);
      this.logSmartContractEvents(operationId);
    } else {
      this.logger.log(`Operation ${operationId} succeeded`);
    }
  }

  private logSmartContractEvents(operationId: string): void {
    this.client
      .smartContracts()
      .getFilteredScOutputEvents({
        emitter_address: null,
        start: null,
        end: null,
        original_caller_address: null,
        original_operation_id: operationId,
        is_final: null,
      })
      .then((events) => {
        events.map((l) =>
          this.logger.error(`opId ${operationId}: execution error ${l.data}`),
        );
      });
  }
}
