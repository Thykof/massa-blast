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
  const args = new Args(binaryArgs);
  const userAddress = args
    .nextSerializable<Address>()
    .expect('userAddress argument is missing or invalid');
  const amount = args.nextU64().expect('amount argument is missing or invalid');
  Storage.set(withdrawableKeyOf(userAddress), u64ToBytes(amount));
  const setWithdrawableForEvent = new SetWithdrawableEvent(userAddress, amount);
  generateEvent(setWithdrawableForEvent.toJson());
  return setWithdrawableForEvent.serialize();
}

export function withdraw(_: StaticArray<u8>): StaticArray<u8> {
  const key = withdrawableKeyOf(Context.caller());
  assert(Storage.has(key), 'No withdrawable amount for the caller.');
  const amountWithdrawableBytes = Storage.get(
    withdrawableKeyOf(Context.caller()),
  );
  const amountWithdrawable = bytesToU64(amountWithdrawableBytes);
  assert(
    amountWithdrawable < MIN_WITHDRAWABLE_AMOUNT,
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
