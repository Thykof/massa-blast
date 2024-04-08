import {
  Context,
  generateEvent,
  Address,
  Storage,
  transferCoins,
  balance,
  setBytecode,
  getKeys,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  stringToBytes,
  u64ToBytes,
  bytesToU64,
  bytesToString,
} from '@massalabs/as-types';
import { u128 } from 'as-bignum/assembly';

import { BlastingSession } from './types/BlastingSession';

// Constants
// TODO: move this constant in a parameter in the storage, editable by the owner
export const MIN_BLASTING_AMOUNT: u64 = 10_000_000_000;

export const BLASTING_ADDRESS_KEY = 'BLASTING_ADDRESS';
export const WITHDRAW_REQUEST_KEY = 'WithdrawRequest_';
export const WITHDRAWABLE_KEY = 'Withdrawable_';
export const MAX_BLASTING_AMOUNT: u64 = 1_000_000_000_000_000;
export const totalBlastingAmountKey = stringToBytes('TotalBlastingAmount');
export const withdrawRequestListKey = stringToBytes('WithdrawRequestList');

export function updateWithdrawRequestOpIdOfBlastingSession(
  caller: string,
  withdrawRequestOpId: string,
): BlastingSession {
  const keyBlastingSession = blastingSessionKeyOf(caller);
  assert(
    Storage.has(keyBlastingSession),
    'No blasting session found for the caller.',
  );
  const blastingSession = new Args(Storage.get(keyBlastingSession))
    .nextSerializable<BlastingSession>()
    .expect('Blasting session is invalid');
  blastingSession.withdrawRequestOpId = withdrawRequestOpId;
  blastingSession.endTimestamp = Context.timestamp();
  Storage.set(keyBlastingSession, new Args().add(blastingSession).serialize());

  return blastingSession;
}

export function addWithdrawRequest(caller: string, opId: string): void {
  const keyWithdrawRequest = withdrawRequestKey(caller);
  assert(
    !Storage.has(keyWithdrawRequest),
    'Withdraw request already exists for this user.',
  );
  Storage.set(keyWithdrawRequest, stringToBytes(opId));
  pushWithdrawRequest(caller);
}

export function pushWithdrawRequest(caller: string): void {
  if (!Storage.has(withdrawRequestListKey)) {
    Storage.set(withdrawRequestListKey, new Args().add([caller]).serialize());
  } else {
    const withdrawRequestList = new Args(Storage.get(withdrawRequestListKey))
      .nextStringArray()
      .expect('Withdraw request list is invalid');
    withdrawRequestList.push(caller);
    Storage.set(
      withdrawRequestListKey,
      new Args().add(withdrawRequestList).serialize(),
    );
  }
}

export function removeWithdrawRequest(
  userAddress: string,
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

export function removeWithdrawRequestFromList(userAddress: string): void {
  if (!Storage.has(withdrawRequestListKey)) {
    throw new Error('Withdraw request list is missing');
  }
  const withdrawRequestList = new Args(Storage.get(withdrawRequestListKey))
    .nextStringArray()
    .expect('Withdraw request list is invalid');
  const index = withdrawRequestList.indexOf(userAddress);
  if (index !== -1) {
    withdrawRequestList.splice(index, 1);
    Storage.set(
      withdrawRequestListKey,
      new Args().add(withdrawRequestList).serialize(),
    );
  }
}

export function increaseTotalBlastingAmount(amount: u64): void {
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

export function decreaseTotalBlastingAmount(amount: u64): void {
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

export function blastingSessionKeyOf(userAddress: string): StaticArray<u8> {
  return stringToBytes('BlastingSession_' + userAddress);
}

export function withdrawableKeyOf(userAddress: string): StaticArray<u8> {
  return stringToBytes(WITHDRAWABLE_KEY + userAddress);
}

export function withdrawRequestKey(userAddress: string): StaticArray<u8> {
  return stringToBytes(WITHDRAW_REQUEST_KEY + userAddress);
}

export function blastingAddress(): string {
  return Storage.get(BLASTING_ADDRESS_KEY);
}

export function selfDestruct(transferToAddr: string): void {
  // 1- empty the SC
  let emptySc = new StaticArray<u8>(0);
  setBytecode(emptySc);

  // 2- delete everything in Storage
  let keys = getKeys();
  for (let i = 0; i < keys.length; i++) {
    Storage.del(keys[i]);
  }

  // 3- transfer back coins if any
  let scBalance = balance();
  // Balance will most likely be > 0 as we deleted some keys from the Storage
  // but if there is nothing in the Storage, no need to call transferCoins
  if (scBalance > 0) {
    transferCoins(new Address(transferToAddr), scBalance);
  }
}

/**
 * Consolidate the necessary payment (including storage fees) to and from the caller.
 * @param initialSCBalance - The balance of the SC at the beginning of the call
 * @param internalSCCredits - Non-storage coins expected to have been received by the SC during the call
 * @param internalSCDebits - Non-storage coins expected to have been sent by the SC during the call
 * @param callerCredit - Non-storage coins expected to have been credited to the caller during the call
 * @param callerDebit - Non-storage coins expected to have been send by the caller to the SC for the call
 */
export function consolidatePayment(
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
      const storageCost = callerCost - callerPayment;

      // caller did not pay enough
      const message =
        'Need at least ' +
        callerCost.toString() +
        ' elementary coin units to pay but only ' +
        callerPayment.toString() +
        ' were sent, storage cost: ' +
        storageCost.toString();
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
