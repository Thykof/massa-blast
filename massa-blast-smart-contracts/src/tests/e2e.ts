import { deposit } from '../lib/deposit';
import { getBalance, getClient, waitOp } from '../lib/utils';
import { fromMAS } from '@massalabs/web3-utils';
import { deployBlaster } from '../lib/deploy';
import { assert } from './utils';
import { requestWithdraw } from '../lib/request-withdraw';
import { setWithdrawableFor } from '../lib/set-withdrawable-for';
import { withdraw } from '../lib/withdraw';
import {
  BASE_ACCOUNT_CREATION_COST,
  STORAGE_BYTE_COST,
} from '@massalabs/massa-web3';

const fee = BigInt(process.env.FEES!);
let contractAddress: string = process.env.ADDRESS_CONTRACT!;
const userAddress = process.env.ADDRESS_USER_1!;
const blastingAddress = process.env.ADDRESS_BLASTING!;
// const ownerAddress = process.env.ADDRESS_FULLPOWER;
const ownerSecretKey = process.env.SECRET_KEY_FULLPOWER!;
const userSecretKey = process.env.SECRET_KEY_USER_1!;
let depositAmount = fromMAS(10);
let rewards = fromMAS(1);
let serviceFees = fromMAS(0.1);
let withdrawRequestOpId = '';
let withdrawableAmount = 0n;
let initialUerBalance = 0n;

async function deploy() {
  contractAddress = await deployBlaster();
  const { client } = await getClient(ownerSecretKey);
  const initialBalance = await getBalance(contractAddress, client);
  assert(initialBalance === 0n, 'Initial contract balance should be 0');
}

async function depositTest() {
  const { client, baseAccount } = await getClient(userSecretKey);
  const initialBalanceBlasting = await getBalance(blastingAddress, client);
  const initialBalance = await getBalance(userAddress, client);
  initialUerBalance = initialBalance;
  const operationId = await deposit(
    client,
    baseAccount,
    depositAmount,
    contractAddress,
  );
  const { status, events } = await waitOp(client, operationId, false);
  console.log(`operationId deposit ${operationId} status: ${status}`);
  events.map((l) => console.log(`Event: ${l.data}`));
  const balance = await getBalance(userAddress, client);
  const estimatedExpectedBalance = initialBalance - depositAmount;
  console.log(
    'depositTest user balances',
    initialBalance,
    balance,
    estimatedExpectedBalance,
  );
  assert(
    estimatedExpectedBalance - initialBalance <
      15600000n + STORAGE_BYTE_COST * 3n, // STORAGE_BYTE_COST * 3n to be safe
    'Balance should be less than initial',
  );
  assert(
    (await getBalance(blastingAddress, client)) - initialBalanceBlasting ===
      depositAmount,
    'Blasting address balance should be increased by deposit amount',
  );
}

async function requestWithdrawTest() {
  const { client, baseAccount } = await getClient(userSecretKey);
  const initialBalance = await getBalance(userAddress, client);
  withdrawRequestOpId = await requestWithdraw(
    client,
    baseAccount,
    contractAddress,
  );
  const { status, events } = await waitOp(client, withdrawRequestOpId, false);
  console.log(`withdrawRequestOpId ${withdrawRequestOpId} status: ${status}`);
  events.map((l) => console.log(`Event: ${l.data}`));
  const balance = await getBalance(userAddress, client);
  console.log('requestWithdrawTest user balances', initialBalance, balance);
}

async function setWithdrawableForTest() {
  const { client, baseAccount } = await getClient(ownerSecretKey);
  const initialBalance = await getBalance(userAddress, client);
  const initialBalanceContract = await getBalance(contractAddress, client);
  withdrawableAmount = depositAmount + rewards - serviceFees;
  const operationId = await setWithdrawableFor(
    client,
    baseAccount,
    contractAddress,
    userAddress,
    withdrawRequestOpId,
    withdrawableAmount,
  );
  const { status, events } = await waitOp(client, operationId, false);
  console.log(
    `operationId setWithdrawableFor ${operationId} status: ${status}`,
  );
  events.map((l) => console.log(`Event: ${l.data}`));
  const balanceContract = await getBalance(contractAddress, client);
  console.log(
    'setWithdrawableForTest contract balances',
    initialBalanceContract,
    balanceContract,
  );
  const balance = await getBalance(userAddress, client);
  console.log('setWithdrawableForTest user balances', initialBalance, balance);
  assert(
    balanceContract === withdrawableAmount,
    'Balance should be the withdrawable amount',
  );
}

async function withdrawTest() {
  const { client, baseAccount } = await getClient(userSecretKey);
  const initialBalance = await getBalance(userAddress, client);
  const initialBalanceContract = await getBalance(contractAddress, client);
  const operationId = await withdraw(client, baseAccount, contractAddress);
  const { status, events } = await waitOp(client, operationId, false);
  console.log(`operationId withdraw ${operationId} status: ${status}`);
  events.map((l) => console.log(`Event: ${l.data}`));
  const balance = await getBalance(userAddress, client);
  console.log('withdrawTest user balances', initialBalance, balance);
  const balanceContract = await getBalance(contractAddress, client);
  console.log(
    'withdrawTest contract balances',
    initialBalanceContract,
    balanceContract,
  );
  assert(
    initialUerBalance + withdrawableAmount - depositAmount === balance,
    'User balance should be increased by withdrawable amount',
  );
  assert(
    (await getBalance(contractAddress, client)) === 0n,
    'Contract balance should be 0',
  );
}

async function topUp(recipientAddress: string, amount: bigint) {
  const { client } = await getClient(ownerSecretKey);
  const operationId = (
    await client.wallet().sendTransaction({
      fee,
      amount,
      recipientAddress,
    })
  )[0];
  const { status } = await waitOp(client, operationId);
  console.log(`top up operationId ${operationId} status: ${status}`);
}

async function main() {
  await deploy();
  await topUp(userAddress, fromMAS(100));
  await topUp(blastingAddress, BASE_ACCOUNT_CREATION_COST);
  await depositTest();
  await requestWithdrawTest();
  await setWithdrawableForTest();
  await withdrawTest();
}

await main();

/**
 * TODO:
 * - create an account for owner different than fullpower
 * - assert the balances better
 *
 */

/**
 * - in deposit user pays for keyBlastingSession (156)
 * - in requestWithdraw user pays for: (total 232)
 *   - keyWithdrawRequest (180)
 *   - update of keyBlastingSession (52) (total blasting session 208)
 * - in setWithdrawableFor system:
 *   - pays for keyWithdrawable (77)
 *   - reimburses user for keyWithdrawRequest (180 bytes)
 * - in withdraw user:
 *   - reimburses system for keyWithdrawable (77)
 *   - get reimburse keyBlastingSession (208)
 */
