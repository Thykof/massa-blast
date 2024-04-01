import { Args, Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

export async function deposit(
  client: Client,
  baseAccount: IBaseAccount,
  amount: bigint,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee: 0n,
      coins: amount + fromMAS(0.1),
      targetAddress: contractAddress,
      targetFunction: 'deposit',
      parameter: new Args().addU64(amount),
    },
    baseAccount,
  );
}
