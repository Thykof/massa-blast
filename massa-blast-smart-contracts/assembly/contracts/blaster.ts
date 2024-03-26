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
} from '@massalabs/as-types';

import {
  onlyOwner,
  setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

import { BlastingSession } from '../types/BlastingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawEvent } from '../events/WithdrawEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';
import {
  addWithdrawRequest,
  BLASTING_ADDRESS_KEY,
  blastingSessionKeyOf,
  consolidatePayment,
  decreaseTotalBlastingAmount,
  increaseTotalBlastingAmount,
  MIN_BLASTING_AMOUNT,
  removeWithdrawRequest,
  updateWithdrawRequestOpIdOfBlastingSession,
  withdrawableKeyOf,
} from '../blaster-internal';

// Exports
export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
export * from '../blaster-read';

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
      ' BlastingAddress set to ' +
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

  const blastingSession = new BlastingSession(
    startTimestamp,
    amount,
    caller.toString(),
  );
  const keyBlastingSession = blastingSessionKeyOf(caller.toString());
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

  let withdrawRequestOpId = getOriginOperationId();
  if (withdrawRequestOpId === null) {
    // Fake an operation ID for the execute_read_only_call
    withdrawRequestOpId = 'O1LNr9xyL9fVHbUvZao4jy6t2Pj5UPtLP0x1fxvS6SD7dPb5S52';
  }
  const blastingSession = updateWithdrawRequestOpIdOfBlastingSession(
    caller,
    withdrawRequestOpId,
  );
  addWithdrawRequest(caller, withdrawRequestOpId);
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
  // TODO: insert here multisig check
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
  const keyBlastingSession = blastingSessionKeyOf(caller.toString());
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
