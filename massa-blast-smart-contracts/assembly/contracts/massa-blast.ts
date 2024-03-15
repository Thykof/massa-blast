import {
  Context,
  generateEvent,
  Address,
  Storage,
  transferCoins,
  balance,
  getOriginOperationId,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  stringToBytes,
  u64ToBytes,
  bytesToU64,
  bytesToString,
} from '@massalabs/as-types';
import { u128 } from 'as-bignum/assembly';

import {
  onlyOwner,
  setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

import { BlastingSession } from '../types/BlastingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawEvent } from '../events/WithdrawEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';

// Exports
export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

// Constants
// TODO: move this constant in a parameter in the storage, editable by the owner
const MIN_BLASTING_AMOUNT: u64 = 10_000_000_000;

const BLASTING_ADDRESS_KEY = stringToBytes('blastingAddress');
const MAX_BLASTING_AMOUNT: u64 = 1_000_000_000_000_000;
const totalBlastingAmountKey = stringToBytes('TotalBlastingAmount');
const withdrawRequestListKey = stringToBytes('WithdrawRequestList');

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 */
export function constructor(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  if (!Context.isDeployingContract()) {
    return stringToBytes('Already deployed');
  }
  setOwner(new Args().add(Context.caller()).serialize());

  const args = new Args(binaryArgs);
  const blastingAddress = args
    .nextSerializable<Address>()
    .expect('blastingAddress argument is missing or invalid');
  Storage.set(BLASTING_ADDRESS_KEY, blastingAddress.serialize());
  generateEvent(
    'Deployed, owner set to ' +
      Context.caller().toString() +
      'BlastingAddress set to ' +
      blastingAddress.toString(),
  );
  return [];
}

export function destroy(_: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();
  generateEvent('Destroyed not implemented yet.');
  return [];
}

export function deposit(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const amount = new Args(binaryArgs)
    .nextU64()
    .expect('amount argument is missing');
  assert(
    amount >= MIN_BLASTING_AMOUNT,
    'Amount is less than the minimum required.',
  );
  const startTimestamp = Context.timestamp();
  const caller = Context.caller();

  const blastingSession = new BlastingSession(startTimestamp, amount, caller);
  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(!Storage.has(keyBlastingSession), 'Blasting session already exists.');
  Storage.set(keyBlastingSession, new Args().add(blastingSession).serialize());
  increaseTotalBlastingAmount(amount);

  // assert that the caller sent enough coins for the storage fees and the amount to be set as withdrawable
  consolidatePayment(initialSCBalance, 0, 0, 0, amount);

  const depositEvent = new DepositEvent(amount, caller, startTimestamp);
  generateEvent(depositEvent.toJson());

  return depositEvent.serialize();
}

export function requestWithdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const caller = Context.caller();

  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(
    Storage.has(keyBlastingSession),
    'No blasting session found for the caller.',
  );
  const blastingSession = new Args(Storage.get(keyBlastingSession))
    .nextSerializable<BlastingSession>()
    .expect('Blasting session is invalid');

  addWithdrawRequest(caller);
  decreaseTotalBlastingAmount(blastingSession.amount);

  consolidatePayment(initialSCBalance, 0, 0, 0, 0);

  const withdrawEvent = new WithdrawEvent(caller);
  generateEvent(withdrawEvent.toJson());
  return withdrawEvent.serialize();
}

export function setWithdrawableFor(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  onlyOwner();

  const initialSCBalance = balance();

  const args = new Args(binaryArgs);
  const userAddress = args
    .nextSerializable<Address>()
    .expect('userAddress argument is missing or invalid');
  const operationId = args
    .nextString()
    .expect('operationId argument is missing');
  const amount = args.nextU64().expect('amount argument is missing');

  removeWithdrawRequest(userAddress, operationId);

  assert(amount > 0, 'Amount must be greater than 0.');
  const keyWithdrawable = withdrawableKeyOf(userAddress);
  assert(!Storage.has(keyWithdrawable), 'Withdrawable amount already set.');
  Storage.set(keyWithdrawable, u64ToBytes(amount));

  // assert that the caller sent enough coins for the storage fees and the amount to be set as withdrawable
  consolidatePayment(initialSCBalance, 0, 0, 0, amount);

  const setWithdrawableForEvent = new SetWithdrawableEvent(userAddress, amount);
  generateEvent(setWithdrawableForEvent.toJson());

  return setWithdrawableForEvent.serialize();
}

export function withdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const caller = Context.caller();

  const keyWithdrawable = withdrawableKeyOf(caller);
  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(
    Storage.has(keyWithdrawable),
    'No withdrawable amount for the caller.',
  );
  const amountWithdrawableBytes = Storage.get(keyWithdrawable);
  const amountWithdrawable = bytesToU64(amountWithdrawableBytes);
  if (amountWithdrawable > balance()) {
    generateEvent(
      'CRITICAL: not enough balance in the contract to withdraw ' +
        amountWithdrawable.toString() +
        ' by ' +
        caller.toString(),
    );
    throw new Error('Not enough balance in the contract to withdraw');
  }
  transferCoins(caller, amountWithdrawable);

  Storage.del(keyWithdrawable);
  Storage.del(keyBlastingSession);

  consolidatePayment(initialSCBalance, 0, amountWithdrawable, 0, 0);

  generateEvent(
    'Withdrawn ' +
      amountWithdrawable.toString() +
      ' by ' +
      Context.caller().toString(),
  );

  return amountWithdrawableBytes;
}

// read
export function totalBlastingAmount(_: StaticArray<u8>): StaticArray<u8> {
  if (!Storage.has(totalBlastingAmountKey)) {
    return u64ToBytes(0);
  }
  return Storage.get(totalBlastingAmountKey);
}

export function getWithdrawRequests(_: StaticArray<u8>): StaticArray<u8> {
  if (!Storage.has(withdrawRequestListKey)) {
    return [];
  }
  return Storage.get(withdrawRequestListKey);
}

export function withdrawable(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args
    .nextSerializable<Address>()
    .expect('userAddress argument is missing or invalid in withdrawable');
  const key = withdrawableKeyOf(userAddress);
  if (!Storage.has(key)) {
    return u64ToBytes(0);
  }
  const amountWithdrawableBytes = Storage.get(key);
  return amountWithdrawableBytes;
}

export function blastingSessionOf(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args
    .nextSerializable<Address>()
    .expect('userAddress argument is missing or invalid');
  const keyBlastingSession = blastingSessionKeyOf(userAddress);
  if (!Storage.has(keyBlastingSession)) {
    return [];
  }
  return Storage.get(keyBlastingSession);
}

export function getBlastingAddress(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(BLASTING_ADDRESS_KEY);
}

// internal functions
function addWithdrawRequest(caller: Address): void {
  let opId = getOriginOperationId();
  if (opId === null) {
    // Fake an operation ID for the execute_read_only_call
    opId = 'O1LNr9xyL9fVHbUvZao4jy6t2Pj5UPtLP0x1fxvS6SD7dPb5S52';
  }

  const keyWithdrawRequest = withdrawRequestKey(caller);
  assert(
    !Storage.has(keyWithdrawRequest),
    'Withdraw request already exists for this user.',
  );
  Storage.set(keyWithdrawRequest, stringToBytes(opId));
  pushWithdrawRequest(caller);
}

function pushWithdrawRequest(caller: Address): void {
  if (!Storage.has(withdrawRequestListKey)) {
    Storage.set(
      withdrawRequestListKey,
      new Args().addSerializableObjectArray<Address>([caller]).serialize(),
    );
  } else {
    const withdrawRequestList = new Args(Storage.get(withdrawRequestListKey))
      .nextSerializableObjectArray<Address>()
      .expect('Withdraw request list is invalid');
    withdrawRequestList.push(caller);
    Storage.set(
      withdrawRequestListKey,
      new Args().addSerializableObjectArray(withdrawRequestList).serialize(),
    );
  }
}

function removeWithdrawRequest(
  userAddress: Address,
  operationId: string,
): void {
  const keyWithdrawRequest = withdrawRequestKey(userAddress);
  assert(Storage.has(keyWithdrawRequest), 'No withdraw request for this user.');
  assert(
    bytesToString(Storage.get(keyWithdrawRequest)) === operationId,
    'operationId does not match the withdraw request.',
  );
  Storage.del(keyWithdrawRequest);
  removeWithdrawRequestFromList(userAddress);
}

function removeWithdrawRequestFromList(userAddress: Address): void {
  if (!Storage.has(withdrawRequestListKey)) {
    throw new Error('Withdraw request list is missing');
  }
  const withdrawRequestList = new Args(Storage.get(withdrawRequestListKey))
    .nextSerializableObjectArray<Address>()
    .expect('Withdraw request list is invalid');
  const index = withdrawRequestList.indexOf(userAddress);
  if (index !== -1) {
    withdrawRequestList.splice(index, 1);
    Storage.set(
      withdrawRequestListKey,
      new Args().addSerializableObjectArray(withdrawRequestList).serialize(),
    );
  }
}

function increaseTotalBlastingAmount(amount: u64): void {
  if (!Storage.has(totalBlastingAmountKey)) {
    Storage.set(totalBlastingAmountKey, u64ToBytes(0));
  }
  const currentAmount = bytesToU64(Storage.get(totalBlastingAmountKey));
  const newAmount = currentAmount + amount;
  if (newAmount > MAX_BLASTING_AMOUNT) {
    throw new Error('Exceeding max blasting amount');
  }
  Storage.set(totalBlastingAmountKey, u64ToBytes(newAmount));
}

function decreaseTotalBlastingAmount(amount: u64): void {
  if (!Storage.has(totalBlastingAmountKey)) {
    throw new Error('Total blasting amount is missing');
  }
  const currentAmount = bytesToU64(Storage.get(totalBlastingAmountKey));
  if (currentAmount < amount) {
    throw new Error('Not enough total blasting amount to decrease');
  }
  const newAmount = currentAmount - amount;
  Storage.set(totalBlastingAmountKey, u64ToBytes(newAmount));
}

function blastingSessionKeyOf(userAddress: Address): StaticArray<u8> {
  return stringToBytes('BlastingSession_' + userAddress.toString());
}

function withdrawableKeyOf(userAddress: Address): StaticArray<u8> {
  return stringToBytes('Withdrawable_' + userAddress.toString());
}

function withdrawRequestKey(userAddress: Address): StaticArray<u8> {
  return stringToBytes('WithdrawRequest_' + userAddress.toString());
}

/**
 * Consolidate the necessary payment (including storage fees) to and from the caller.
 * @param initialSCBalance - The balance of the SC at the beginning of the call
 * @param internalSCCredits - Non-storage coins expected to have been received by the SC during the call
 * @param internalSCDebits - Non-storage coins expected to have been sent by the SC during the call
 * @param callerCredit - Non-storage coins expected to have been credited to the caller during the call
 * @param callerDebit - Non-storage coins expected to have been send by the caller to the SC for the call
 */
function consolidatePayment(
  initialSCBalance: u64,
  internalSCCredits: u64,
  internalSCDebits: u64,
  callerCredit: u64,
  callerDebit: u64,
): void {
  // How much we charge the caller:
  // caller_cost = initial_sc_balance + internal_sc_credits + caller_debit
  // - internal_sc_debits - caller_credit - get_balance()
  const callerCostPos: u128 =
    u128.fromU64(initialSCBalance) +
    u128.fromU64(internalSCCredits) +
    u128.fromU64(callerDebit);
  const callerCostNeg: u128 =
    u128.fromU64(internalSCDebits) +
    u128.fromU64(callerCredit) +
    u128.fromU64(balance());
  const callerPayment: u128 = u128.fromU64(Context.transferredCoins());

  if (callerCostPos >= callerCostNeg) {
    // caller needs to pay
    const callerCost: u128 = callerCostPos - callerCostNeg;
    const delta: u128 = callerPayment - callerCost;
    if (callerPayment < callerCost) {
      // caller did not pay enough
      const message =
        'Need at least ' +
        callerCost.toString() +
        ' elementary coin units to pay but only ' +
        callerPayment.toString() +
        ' were sent, delta: ' +
        delta.toString();
      generateEvent('[consolidatePayment] ' + message);
      throw new Error(message);
    } else if (callerPayment > callerCost) {
      // caller paid too much: send remainder back
      if (delta > u128.fromU64(u64.MAX_VALUE)) {
        throw new Error('Overflow');
      }
      generateEvent(
        '[consolidatePayment] Sending back ' +
          delta.toString() +
          ' to ' +
          Context.caller().toString(),
      );
      transferCoins(Context.caller(), delta.toU64());
    }
  } else {
    // caller needs to be paid
    const delta: u128 = callerCostNeg - callerCostPos + callerPayment;
    if (delta > u128.fromU64(u64.MAX_VALUE)) {
      throw new Error('Overflow');
    }
    generateEvent(
      '[consolidatePayment] Sending ' +
        delta.toString() +
        ' to ' +
        Context.caller().toString(),
    );
    transferCoins(Context.caller(), delta.toU64());
  }
}
