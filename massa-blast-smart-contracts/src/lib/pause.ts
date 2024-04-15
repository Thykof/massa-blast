import {
  byteToBool,
  Client,
  IBaseAccount,
  MAX_GAS_CALL,
} from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

const fee = BigInt(process.env.FEES!);

export async function isPaused(client: Client) {
  const result = await client.smartContracts().readSmartContract({
    targetAddress: process.env.ADDRESS_CONTRACT!,
    targetFunction: 'isPaused',
    parameter: [],
  });
  return byteToBool(result.returnValue);
}

export async function pause(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee,
      targetAddress: contractAddress,
      targetFunction: 'pause',
      parameter: [],
      maxGas: MAX_GAS_CALL,
    },
    baseAccount,
  );
}

export async function unpause(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee,
      targetAddress: contractAddress,
      targetFunction: 'unpause',
      parameter: [],
      maxGas: MAX_GAS_CALL,
    },
    baseAccount,
  );
}
