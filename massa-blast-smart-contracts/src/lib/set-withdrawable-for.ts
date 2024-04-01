import { Args, Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

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
      fee: 0n,
      coins: amount + fromMAS(0.1),
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
