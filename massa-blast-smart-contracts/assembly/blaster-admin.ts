import {
  Args,
  boolToByte,
  bytesToString,
  bytesToU64,
  stringToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  Address,
  balance,
  Context,
  generateEvent,
  Storage,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import {
  onlyOwner,
  ownerAddress,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
import { _setOwner } from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';
import { BLASTING_ADDRESS_KEY, consolidatePayment } from './blaster-internal';

export const REQUEST_CHANGE_OWNER_TIMESTAMP_KEY = stringToBytes(
  'REQUEST_CHANGE_OWNER_TIMESTAMP',
);
export const REQUEST_WITHDRAW_TIMESTAMP_KEY = stringToBytes(
  'REQUEST_WITHDRAW_TIMESTAMP',
);
export const FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY = stringToBytes(
  'FORCE_PAUSE_DEPOSIT_TIMESTAMP',
);

export const LONG_TIME_LOCK = 60 * 60 * 24 * 3; // 3 days
export const MEDIUM_TIME_LOCK = 60 * 60 * 24 * 2; // 2 days
export const SHORT_TIME_LOCK = 60 * 60 * 24; // 1 day

export const PAUSED_DEPOSIT_KEY = stringToBytes('PAUSED_DEPOSIT');

export function pause(_: StaticArray<u8>): void {
  onlyOwner();
  const initialSCBalance = balance();
  Storage.set(PAUSED_DEPOSIT_KEY, boolToByte(true));
  consolidatePayment(initialSCBalance, 0, 0, 0, 0);
}

export function unpause(_: StaticArray<u8>): void {
  onlyOwner();
  const initialSCBalance = balance();

  if (Storage.has(FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY)) {
    generateEvent(Context.timestamp().toString());
    if (
      Context.timestamp() >
      bytesToU64(Storage.get(FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY)) +
        MEDIUM_TIME_LOCK
    ) {
      Storage.del(FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY);
      Storage.set(PAUSED_DEPOSIT_KEY, boolToByte(false));
    } else {
      throw new Error('Contract is paused.');
    }
  } else {
    Storage.set(PAUSED_DEPOSIT_KEY, boolToByte(false));
  }

  consolidatePayment(initialSCBalance, 0, 0, 0, 0);
}

export function isPaused(_: StaticArray<u8>): StaticArray<u8> {
  if (Storage.has(FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY)) {
    return boolToByte(true);
  }
  generateEvent(Context.timestamp().toString());

  if (!Storage.has(PAUSED_DEPOSIT_KEY)) {
    return boolToByte(false);
  }
  return Storage.get(PAUSED_DEPOSIT_KEY);
}

/**
 * If an attacker steals the private key of the blasting address, they can steal the balance and sell all the rolls.
 * The legit owner will have the opportunity the move the funds out of the account before the attacker,
 * when found become available (sold rolls are in deferred credit for 3 cycles).
 * The legit owner also have to alert all the users to stop depositing funds in the contract,
 * because the contract transfer the deposited funds to the blasting address.
 * The legit owner will have to change back immediately the blasting address.
 * Changing the blasting address has a consequence: pause the contract for 2 days.
 * So that if an attacker changes the blasting address, the legit owner will have the time to alert all the users.
 *
 * If an attacker can call this function, they can change the blasting address.
 * The system will monitor and alert when this event is emitted, and alert users to stop depositing funds.
 */
export function changeBlastingAddress(binaryArgs: StaticArray<u8>): void {
  onlyOwner();
  const initialSCBalance = balance();
  assert(isPaused([]), 'Contract is paused.');
  const args = new Args(binaryArgs);
  const newBlastingAddress = args
    .nextString()
    .expect('newBlastingAddress argument is missing');

  // TODO: monitor and alert when this event is emitted
  generateEvent(`Blasting address changed to: ' ${newBlastingAddress}`);

  Storage.set(
    FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY,
    u64ToBytes(Context.timestamp()),
  );

  Storage.set(BLASTING_ADDRESS_KEY, newBlastingAddress);
  consolidatePayment(initialSCBalance, 0, 0, 0, 0);
}

/**
 *  Set the contract owner
 *
 * If an attacker can call this function, they can change the owner of the contract.
 * The system will monitor and alert when this event is emitted.
 * The legit owner will tell all users to withdraw their funds in 3 days (1 day time lock for changing owner,
 * and 2 days for withdrawing).
 * The legit owner will have to wait for a time lock of 1 day to change the owner to a new legit address.
 * But the attacker may succeed to change the owner.
 *
 * @param binaryArgs - byte string with the following format:
 * - the address of the new contract owner (address).
 */
export function setOwner(binaryArgs: StaticArray<u8>): void {
  onlyOwner();
  const initialSCBalance = balance();

  const args = new Args(binaryArgs);
  const futureOwner = args
    .nextString()
    .expect('futureOwner argument is missing');

  if (!Storage.has(REQUEST_CHANGE_OWNER_TIMESTAMP_KEY)) {
    Storage.set(
      REQUEST_CHANGE_OWNER_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp()),
    );
    consolidatePayment(initialSCBalance, 0, 0, 0, 0);
    // TODO: monitor and alert when this event is emitted
    generateEvent('Change owner requested to:' + futureOwner.toString());
    return;
  }

  assert(
    Context.timestamp() >
      bytesToU64(Storage.get(REQUEST_CHANGE_OWNER_TIMESTAMP_KEY)) +
        SHORT_TIME_LOCK,
    'Change owner request is not yet available',
  );

  _setOwner(futureOwner);

  Storage.del(REQUEST_CHANGE_OWNER_TIMESTAMP_KEY);
  consolidatePayment(initialSCBalance, 0, 0, 0, 0);
}

/**
 * If attacker can call this function, they can steal all the funds in the contract after a long time lock.
 * The time lock is set to 3 days.
 * The legit owner can change the owner (with a time lock of 1 day) and then withdraw the funds.
 */
export function ownerWithdraw(_: StaticArray<u8>): void {
  onlyOwner();
  const initialSCBalance = balance();

  if (!Storage.has(REQUEST_WITHDRAW_TIMESTAMP_KEY)) {
    Storage.set(
      REQUEST_WITHDRAW_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp()),
    );
    generateEvent('Withdraw requested'); // TODO: monitor and alert when this event is emitted
    consolidatePayment(initialSCBalance, 0, 0, 0, 0);
    return;
  }

  assert(
    Context.timestamp() >
      bytesToU64(Storage.get(REQUEST_WITHDRAW_TIMESTAMP_KEY)) + LONG_TIME_LOCK,
    'Withdraw request is not yet available',
  );

  const recipient = new Address(bytesToString(ownerAddress([])));
  const amount = initialSCBalance;
  transferCoins(recipient, amount);

  Storage.del(REQUEST_WITHDRAW_TIMESTAMP_KEY);

  generateEvent(
    'Owner withdrawn ' + amount.toString() + ' to ' + recipient.toString(),
  );

  consolidatePayment(initialSCBalance, 0, amount, 0, 0);
}
