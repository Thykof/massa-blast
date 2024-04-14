import { Storage } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes, u64ToBytes } from '@massalabs/as-types';

import { BlastingSession } from './types/BlastingSession';
import {
  blastingAddress,
  blastingSessionKeyOf,
  totalBlastingAmountKey,
  withdrawableKeyOf,
  withdrawRequestListKey,
} from './blaster-internal';

export function totalBlastingAmount(_: StaticArray<u8>): StaticArray<u8> {
  if (!Storage.has(totalBlastingAmountKey)) {
    return u64ToBytes(0);
  }
  return Storage.get(totalBlastingAmountKey);
}

export function getBlastingSessionsOfPendingWithdrawRequests(
  _: StaticArray<u8>,
): StaticArray<u8> {
  if (!Storage.has(withdrawRequestListKey)) {
    return [];
  }
  const withdrawRequests = new Args(Storage.get(withdrawRequestListKey))
    .nextStringArray()
    .expect('Withdraw request list is invalid');
  const stackingSessions: BlastingSession[] = [];
  for (let i = 0; i < withdrawRequests.length; i++) {
    const keyBlastingSession = blastingSessionKeyOf(withdrawRequests[i]);
    if (Storage.has(keyBlastingSession)) {
      stackingSessions.push(
        new Args(Storage.get(keyBlastingSession))
          .nextSerializable<BlastingSession>()
          .expect('Blasting session is invalid at index ' + i.toString()),
      );
    }
  }

  return new Args().addSerializableObjectArray(stackingSessions).serialize();
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
    .nextString()
    .expect('userAddress argument is missing or invalid in withdrawable');
  const key = withdrawableKeyOf(userAddress);
  if (!Storage.has(key)) {
    return u64ToBytes(0);
  }
  return Storage.get(key);
}

export function blastingSessionOf(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const userAddress = args
    .nextString()
    .expect('userAddress argument is missing or invalid');
  const keyBlastingSession = blastingSessionKeyOf(userAddress);
  if (!Storage.has(keyBlastingSession)) {
    return [];
  }
  return Storage.get(keyBlastingSession);
}

export function getBlastingAddress(_: StaticArray<u8>): StaticArray<u8> {
  return stringToBytes(blastingAddress());
}
