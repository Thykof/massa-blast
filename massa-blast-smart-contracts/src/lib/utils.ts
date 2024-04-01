import { ISCData } from '@massalabs/massa-sc-deployer';
import {
  Args,
  Client,
  EOperationStatus,
  fromMAS,
  IAccount,
  IBaseAccount,
  ProviderType,
  PublicApiClient,
  u64ToBytes,
  u8toByte,
  WalletClient,
  Web3Account,
} from '@massalabs/massa-web3';
import { IEvent } from '@massalabs/web3-utils';

export const getClient = async (
  secretKey: string,
): Promise<{
  client: Client;
  account: IAccount;
  baseAccount: IBaseAccount;
  chainId: bigint;
}> => {
  const account = await WalletClient.getAccountFromSecretKey(secretKey);

  const clientConfig = {
    retryStrategyOn: true,
    providers: [
      { url: process.env.JSON_RPC_URL_PUBLIC!, type: ProviderType.PUBLIC },
    ],
    periodOffset: 9,
  };

  const publicApi = new PublicApiClient(clientConfig);
  const status = await publicApi.getNodeStatus();

  const web3account = new Web3Account(account, publicApi, status.chain_id);
  const client = new Client(clientConfig, web3account, publicApi);

  return {
    client,
    account,
    baseAccount: client.wallet().getBaseAccount()!,
    chainId: status.chain_id,
  };
};

export async function waitOp(
  client: Client,
  operationId: string,
  untilFinal = true,
) {
  const status = await client
    .smartContracts()
    .awaitMultipleRequiredOperationStatus(operationId, [
      EOperationStatus.SPECULATIVE_ERROR,
      EOperationStatus.SPECULATIVE_SUCCESS,
    ]);

  const events = await client.smartContracts().getFilteredScOutputEvents({
    start: null,
    end: null,
    original_caller_address: null,
    original_operation_id: operationId,
    emitter_address: null,
    is_final: null,
  });

  if (!untilFinal) return { status, events };

  await client
    .smartContracts()
    .awaitMultipleRequiredOperationStatus(operationId, [
      EOperationStatus.FINAL_ERROR,
      EOperationStatus.FINAL_SUCCESS,
    ]);

  return {
    status,
    events,
  };
}

export const getContractAddressFromDeploy = (events: IEvent[]): string => {
  const deployedSCEvent = events?.find((e) =>
    e.data.includes('Contract deployed at address'),
  );

  if (!deployedSCEvent) {
    throw new Error('failed to retrieve deploy address');
  }

  return deployedSCEvent.data.substring(
    'Contract deployed at address: '.length,
    deployedSCEvent.data.length,
  );
};

export async function getBalance(
  address: string,
  client: Client,
): Promise<bigint> {
  return fromMAS(
    (await client.publicApi().getAddresses([address]))[0].candidate_balance,
  );
}
