import { Args, Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

const fee = BigInt(process.env.FEES!);

export async function setWithdrawableFor(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
  recipientAddress: string,
  operationId: string,
  amount: bigint,
) {
  return await client.smartContracts().callSmartContract(
    {
      fee,
      coins: amount + fromMAS(0.007_800_000),
      targetAddress: contractAddress,
      targetFunction: 'setWithdrawableFor',
      parameter: new Args()
        .addString(recipientAddress)
        .addString(operationId)
        .addU64(amount),
    },
    baseAccount,
  );
}
