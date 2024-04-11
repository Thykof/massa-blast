import { Client, fromMAS, IBaseAccount } from '@massalabs/massa-web3';
import { config } from 'dotenv';
config();

const fee = BigInt(process.env.FEES!);

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
    fee,
  });
  console.log(readOnlyCall.info.gas_cost); // 28677423
  return await client.smartContracts().callSmartContract(
    {
      fee,
      maxGas: BigInt(Math.floor(readOnlyCall.info.gas_cost * 1.2)),
      coins: fromMAS(0.023_70_000),
      targetAddress: contractAddress,
      targetFunction: 'requestWithdraw',
      parameter: [],
    },
    baseAccount,
  );
}
