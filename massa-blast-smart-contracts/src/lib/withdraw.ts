import { Client, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

export async function withdraw(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee: 0n,
      targetAddress: contractAddress,
      targetFunction: 'withdraw',
      parameter: [],
    },
    baseAccount,
  );
}
