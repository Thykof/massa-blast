import { Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

export async function requestWithdraw(
  client: Client,
  baseAccount: IBaseAccount,
  contractAddress: string,
) {
  const readOnlyCall = await client.smartContracts().readSmartContract({
    targetAddress: contractAddress,
    targetFunction: 'requestWithdraw',
    parameter: [],
    coins: fromMAS(0.1),
  });
  console.log(readOnlyCall.info.gas_cost);
  // 28677423
  return await client.smartContracts().callSmartContract(
    {
      fee: 0n,
      maxGas: BigInt(Math.floor(readOnlyCall.info.gas_cost * 1.2)),
      coins: fromMAS(0.1),
      targetAddress: contractAddress,
      targetFunction: 'requestWithdraw',
      parameter: [],
    },
    baseAccount,
  );
}
