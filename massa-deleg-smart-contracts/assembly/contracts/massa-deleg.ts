// The entry file of your WebAssembly module.
import {
  Context,
  generateEvent,
  Address,
  transferredCoins,
  Storage,
  transferCoins,
  balance,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  stringToBytes,
  u64ToBytes,
  bytesToU64,
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
export const MIN_WITHDRAWABLE_AMOUNT: u64 = 10_000_000_000;

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
  const userAddress = Context.caller();

  const stackingSession = new StackingSession(
    startTimestamp,
    amount,
    userAddress,
  );
  Storage.set(stackingSessionKeyOf(userAddress), stackingSession.serialize());

  const depositEvent = new DepositEvent(amount, userAddress, startTimestamp);
  generateEvent(depositEvent.toJson());

  return depositEvent.serialize();
}

export function requestWithdraw(_: StaticArray<u8>): StaticArray<u8> {
  const withdrawEvent = new WithdrawEvent(Context.caller());
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
  const amount = transferredCoins();
  assert(amount > 0, 'Amount must be greater than 0.');
  Storage.set(withdrawableKeyOf(userAddress), u64ToBytes(amount));

  consolidatePayment(initialSCBalance, 0, 0, 0, amount);

  const setWithdrawableForEvent = new SetWithdrawableEvent(userAddress, amount);
  generateEvent(setWithdrawableForEvent.toJson());

  return setWithdrawableForEvent.serialize();
}

export function withdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();

  const key = withdrawableKeyOf(Context.caller());
  assert(Storage.has(key), 'No withdrawable amount for the caller.');
  const amountWithdrawableBytes = Storage.get(key);
  const amountWithdrawable = bytesToU64(amountWithdrawableBytes);
  assert(
    amountWithdrawable >= MIN_WITHDRAWABLE_AMOUNT,
    'Withdrawable amount ' +
      amountWithdrawable.toString() +
      ' is less than the minimum required: ' +
      MIN_WITHDRAWABLE_AMOUNT.toString(),
  );
  if (amountWithdrawable > balance()) {
    generateEvent(
      'CRITICAL: not enough balance in the contract to withdraw ' +
        amountWithdrawable.toString() +
        ' by ' +
        Context.caller().toString(),
    );
    throw new Error('Not enough balance in the contract to withdraw');
  }
  transferCoins(Context.caller(), amountWithdrawable);

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
