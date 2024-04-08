import { Client, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

const fee = BigInt(process.env.FEES!);

export async function withdraw(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee,
      targetAddress: contractAddress,
      targetFunction: 'withdraw',
      parameter: [],
    },
    baseAccount,
  );
}
