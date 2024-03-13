// The entry file of your WebAssembly module.
import {
  Context,
  generateEvent,
  Address,
  transferredCoins,
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

import { StackingSession } from '../types/StackingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawEvent } from '../events/WithdrawEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';

// Exports
export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

// Constants
// TODO: move this constant in a parameter in the storage, editable by the owner
export const MIN_STACKING_AMOUNT: u64 = 10_000_000_000;

const STACKING_ADDRESS_KEY = stringToBytes('stackingAddress');

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
  const stackingAddress = args
    .nextSerializable<Address>()
    .expect('stackingAddress argument is missing or invalid');
  Storage.set(STACKING_ADDRESS_KEY, stackingAddress.serialize());
  generateEvent(
    'Deployed, owner set to ' +
      Context.caller().toString() +
      'StackingAddress set to ' +
      stackingAddress.toString(),
  );
  return [];
}

export function destroy(_: StaticArray<u8>): StaticArray<u8> {
  onlyOwner();
  generateEvent('Destroyed not implemented yet.');
  return [];
}

export function deposit(_: StaticArray<u8>): StaticArray<u8> {
  const amount = transferredCoins();
  assert(
    amount >= MIN_STACKING_AMOUNT,
    'Amount is less than the minimum required.',
  );
  const startTimestamp = Context.timestamp();
  const caller = Context.caller();

  const stackingSession = new StackingSession(startTimestamp, amount, caller);
  Storage.set(stackingSessionKeyOf(caller), stackingSession.serialize());

  const depositEvent = new DepositEvent(amount, caller, startTimestamp);
  generateEvent(depositEvent.toJson());

  return depositEvent.serialize();
}

export function requestWithdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const caller = Context.caller();

  let opId = getOriginOperationId();
  if (opId === null) {
    // Fake an operation ID for the execute_read_only_call
    opId = 'O1LNr9xyL9fVHbUvZao4jy6t2Pj5UPtLP0x1fxvS6SD7dPb5S52';
  }

  const keyStackingSession = stackingSessionKeyOf(caller);
  assert(
    Storage.has(keyStackingSession),
    'No stacking session found for the caller.',
  );

  const keyWithdrawRequest = withdrawRequestKey(opId);
  assert(
    !Storage.has(keyWithdrawRequest),
    'Withdraw request already exists for the operationId.',
  );
  Storage.set(keyWithdrawRequest, stringToBytes(caller.toString()));

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

  const key = withdrawRequestKey(operationId);
  assert(Storage.has(key), 'No withdraw request for the operationId.');
  assert(
    bytesToString(Storage.get(key)) === userAddress.toString(),
    'User address does not match the withdraw request.',
  );
  Storage.del(key);

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
  Storage.del(stackingSessionKeyOf(caller));

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

export function stackingSessionOf(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args
    .nextSerializable<Address>()
    .expect('userAddress argument is missing or invalid');
  const key = stackingSessionKeyOf(userAddress);
  if (!Storage.has(key)) {
    return [];
  }
  return Storage.get(key);
}

export function getStackingAddress(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(STACKING_ADDRESS_KEY);
}

// internal functions
function stackingSessionKeyOf(userAddress: Address): StaticArray<u8> {
  return stringToBytes('StackingSession_' + userAddress.toString());
}

function withdrawableKeyOf(userAddress: Address): StaticArray<u8> {
  return stringToBytes('Withdrawable_' + userAddress.toString());
}

function withdrawRequestKey(operationId: string): StaticArray<u8> {
  return stringToBytes('WithdrawRequest_' + operationId);
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
