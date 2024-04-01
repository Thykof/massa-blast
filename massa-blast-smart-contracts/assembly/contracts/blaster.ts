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
  boolToByte,
  byteToBool,
  bytesToString,
} from '@massalabs/as-types';

import {
  onlyOwner,
  ownerAddress,
  setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

import { BlastingSession } from '../types/BlastingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawRequestEvent } from '../events/WithdrawRequestEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';
import {
  addWithdrawRequest,
  BLASTING_ADDRESS_KEY,
  blastingAddress,
  blastingSessionKeyOf,
  consolidatePayment,
  decreaseTotalBlastingAmount,
  increaseTotalBlastingAmount,
  MIN_BLASTING_AMOUNT,
  removeWithdrawRequest,
  updateWithdrawRequestOpIdOfBlastingSession,
  withdrawableKeyOf,
  withdrawRequestListKey,
} from '../blaster-internal';
import { isPaused, PAUSED_KEY } from '../blaster-admin';
import { blastingSessionOf } from '../blaster-read';
import {
  costOfKeyWithdrawable,
  costOfRequestWithdraw,
} from '../storage-cost';
import { WithdrawnEvent } from '../events/WithdrawnEvent';

// Exports
export { ownerAddress } from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
export * from '../blaster-read';
export * from '../blaster-admin';

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
  increaseTotalBlastingAmount(0);
  Storage.set(
    withdrawRequestListKey,
    new Args().add([] as string[]).serialize(),
  );

  const args = new Args(binaryArgs);
  const blastingAddress = args
    .nextString()
    .expect('blastingAddress argument is missing or invalid');

  Storage.set(BLASTING_ADDRESS_KEY, blastingAddress);
  Storage.set(PAUSED_KEY, boolToByte(false));

  generateEvent('BlastingAddress set to ' + blastingAddress);
  return [];
}

export function deposit(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  assert(!byteToBool(isPaused([])), 'Contract is paused.');
  const amount = new Args(binaryArgs)
    .nextU64()
    .expect('amount argument is missing');
  assert(
    amount >= MIN_BLASTING_AMOUNT,
    'Amount is less than the minimum required.',
  );
  const startTimestamp = Context.timestamp();
  const caller = Context.caller().toString();

  const blastingSession = new BlastingSession(startTimestamp, amount, caller);
  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(!Storage.has(keyBlastingSession), 'Blasting session already exists.');
  Storage.set(keyBlastingSession, new Args().add(blastingSession).serialize());
  increaseTotalBlastingAmount(amount);

  transferCoins(new Address(blastingAddress()), amount);

  // assert that the caller sent enough coins for the storage fees and the amount to be set as withdrawable
  consolidatePayment(initialSCBalance, 0, 0, 0, 0);

  const depositEvent = new DepositEvent(amount, caller, startTimestamp);
  generateEvent(depositEvent.toJson());

  return depositEvent.serialize();
}

export function requestWithdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const caller = Context.caller().toString();

  let withdrawRequestOpId = getOriginOperationId();
  if (withdrawRequestOpId === null) {
    // Fake an operation ID for the execute_read_only_call
    withdrawRequestOpId = 'O1LNr9xyL9fVHbUvZao4jy6t2Pj5UPtLP0x1fxvS6SD7dPb5S52';
  }
  const blastingSession = updateWithdrawRequestOpIdOfBlastingSession(
    caller,
    withdrawRequestOpId,
  );
  generateEvent(
    `[requestWithdraw] cost of the operation: ${costOfRequestWithdraw(
      caller,
      withdrawRequestOpId,
    )}`,
  );
  addWithdrawRequest(caller, withdrawRequestOpId);
  decreaseTotalBlastingAmount(blastingSession.amount);

  consolidatePayment(initialSCBalance, 0, 0, 0, 0);

  const withdrawEvent = new WithdrawRequestEvent(caller);
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
    .nextString()
    .expect('userAddress argument is missing or invalid');
  const operationId = args
    .nextString()
    .expect('operationId argument is missing');
  const amount = args.nextU64().expect('amount argument is missing');
  assert(amount > 0, 'Amount must be greater than 0.');

  // assert that amount is at least the deposit amount
  const blastingSessions = new Args(
    blastingSessionOf(new Args().add(userAddress).serialize()),
  )
    .nextSerializable<BlastingSession>()
    .expect('Blasting session is invalid');
  assert(amount >= blastingSessions.amount, 'Amount is less than the deposit.');

  // remove the withdraw request
  removeWithdrawRequest(userAddress, operationId);

  // reimburse the user for the cost of the request withdraw operation
  const amountToReimburse = costOfRequestWithdraw(userAddress, operationId);
  generateEvent(
    `[setWithdrawableFor] cost of the operation (amountToReimburse): ${amountToReimburse}`,
  );
  transferCoins(new Address(userAddress), amountToReimburse);

  // assert that the user has not already set a withdrawable amount
  const keyWithdrawable = withdrawableKeyOf(userAddress);
  assert(!Storage.has(keyWithdrawable), 'Withdrawable amount already set.');

  // TODO: insert here multisig check

  // save the amount as withdrawable
  Storage.set(keyWithdrawable, u64ToBytes(amount));
  generateEvent(
    `[setWithdrawableFor] cost of the key withdrawable: ${costOfKeyWithdrawable(
      userAddress,
    )}`,
  );

  // assert that the caller sent enough coins for the storage fees and the amount to be set as withdrawable
  consolidatePayment(initialSCBalance, 0, 0, 0, amount);

  // generate event and return
  const setWithdrawableForEvent = new SetWithdrawableEvent(userAddress, amount);
  generateEvent(setWithdrawableForEvent.toJson());

  return setWithdrawableForEvent.serialize();
}

export function withdraw(_: StaticArray<u8>): StaticArray<u8> {
  const initialSCBalance = balance();
  const caller = Context.caller().toString();

  const keyWithdrawable = withdrawableKeyOf(caller);
  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(
    Storage.has(keyWithdrawable),
    'No withdrawable amount for the caller.',
  );
  const amountWithdrawableBytes = Storage.get(keyWithdrawable);
  const amountWithdrawable = bytesToU64(amountWithdrawableBytes);
  if (amountWithdrawable > balance()) {
    // TODO: monitor this event
    generateEvent(
      'CRITICAL: not enough balance in the contract to withdraw ' +
        amountWithdrawable.toString() +
        ' by ' +
        caller,
    );
    throw new Error('Not enough balance in the contract to withdraw');
  }
  transferCoins(new Address(caller), amountWithdrawable);

  // remove the withdrawable amount
  Storage.del(keyWithdrawable);
  const amountToReimburse = costOfKeyWithdrawable(caller);
  generateEvent(`[withdraw] amountToReimburse: ${amountToReimburse}`);
  transferCoins(
    new Address(bytesToString(ownerAddress([]))),
    amountToReimburse,
  );

  // remove the blasting session
  Storage.del(keyBlastingSession);

  consolidatePayment(initialSCBalance, 0, amountWithdrawable, 0, 0);

  // generate event and return
  const withdrawnEvent = new WithdrawnEvent(caller, amountWithdrawable);
  generateEvent(withdrawnEvent.toJson());
  return amountWithdrawableBytes;
  // return withdrawnEvent.serialize();
}
