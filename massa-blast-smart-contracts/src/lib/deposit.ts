import { Args, Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

const fee = BigInt(process.env.FEES!);

export async function deposit(
  client: Client,
  baseAccount: IBaseAccount,
  amount: bigint,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee,
      coins: amount + fromMAS(0.015_800_000),
      targetAddress: contractAddress,
      targetFunction: 'deposit',
      parameter: new Args().addU64(amount),
    },
    baseAccount,
  );
}
