import {
  Args,
  ArrayTypes,
  Client,
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
  public blastContract: string = process.env.CONTRACT_ADDRESS;
  private defaultFees = 1000n;

  public async onModuleInit(): Promise<void> {
    const adminAccount = await WalletClient.getAccountFromSecretKey(
      process.env.MASSA_PK,
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
      return 0n;
    }

    return fromMAS(res[0].final_balance);
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
    return args.nextSerializableObjectArray<BlastingSession>(BlastingSession);
  }

  public async setWithdrawableFor(
    userAddress: string,
    operationId: string,
    amount: bigint,
  ): Promise<void> {
    const opId = await this.client.smartContracts().callSmartContract({
      fee: this.defaultFees,
      targetAddress: this.blastContract,
      targetFunction: 'setWithdrawableFor',
      parameter: new Args()
        .addString(userAddress)
        .addString(operationId)
        .addU64(amount),
    });
    this.logger.log(`setWithdrawableFor operation ID: ${opId}`);
  }

  public async sellRolls(rollAmount: bigint): Promise<void> {
    await this.client.wallet().sellRolls({
      fee: this.defaultFees,
      amount: rollAmount,
    });
  }

  public async buyRolls(rollAmount: bigint): Promise<void> {
    await this.client.wallet().buyRolls({
      fee: this.defaultFees,
      amount: rollAmount,
    });
  }

  private async getAddress(address: string): Promise<IAddressInfo | null> {
    const res = await this.client.publicApi().getAddresses([address]);
    if (res.length === 0) {
      this.logger.error(`Address ${address} not found`);
      return null;
    }
    return res[0];
  }
}
