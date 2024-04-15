import * as dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';
import { deploySC, WalletClient } from '@massalabs/massa-sc-deployer';
import {
  fromMAS,
  MAX_GAS_DEPLOYMENT,
  CHAIN_ID,
  STORAGE_BYTE_COST,
} from '@massalabs/massa-web3';
import { Args } from '@massalabs/web3-utils';
import { getContractAddressFromDeploy } from './utils';

// Load .env file content into process.env
dotenv.config();

// Get environment variables
const publicApi = process.env.JSON_RPC_URL_PUBLIC!;
const secretKey = process.env.SECRET_KEY_FULLPOWER!;
// Define deployment parameters
const chainId = CHAIN_ID.Sandbox; // Choose the chain ID corresponding to the network you want to deploy to
const maxGas = MAX_GAS_DEPLOYMENT; // Gas for deployment Default is the maximum gas allowed for deployment
const fees = BigInt(process.env.FEES!); // Fees to be paid for deployment
const waitFirstEvent = true;

// Create an account using the private key
const deployerAccount = await WalletClient.getAccountFromSecretKey(secretKey);

/**
 * Deploy one or more smart contracts.
 *
 * @remarks
 * Multiple smart contracts can be deployed by adding more objects to the array.
 * In this example one contract located at 'build/main.wasm' is deployed with
 * 0.1 MASSA and an argument 'Test'.
 *
 * After all deployments, it terminates the process.
 */
export async function deployBlaster() {
  const owner = process.env.ADDRESS_FULLPOWER!;
  const blastingAddress = process.env.ADDRESS_BLASTING!;
  const costOwner = 4 + 5 + owner.length;
  const costBlastingAddress = 4 + 16 + blastingAddress.length;
  const costBlastingAmount = 4 + 19 + 8;
  const costPause = 4 + 14 + 1;
  const costWithdrawList = 4 + 19 + 4;
  const storageCost =
    costOwner +
    costBlastingAddress +
    costBlastingAmount +
    costPause +
    costWithdrawList;
  const result = await deploySC(
    publicApi, // JSON RPC URL
    deployerAccount, // account deploying the smart contract(s)
    [
      {
        data: readFileSync(path.join('build', 'blaster.wasm')), // smart contract bytecode
        coins: BigInt(storageCost) * STORAGE_BYTE_COST, // coins for deployment
        args: new Args().addString(blastingAddress),
      },
      // Additional smart contracts can be added here for deployment
    ],
    chainId,
    fees,
    maxGas,
    waitFirstEvent,
  );

  const contractAddress = getContractAddressFromDeploy(result.events!);
  console.log(`New contract address: ${contractAddress}`);
  return contractAddress;
}
