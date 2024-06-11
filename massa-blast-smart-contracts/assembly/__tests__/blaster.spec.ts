import {
  Args,
  bytesToString,
  byteToBool,
  stringToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  constructor,
  getBlastingAddress,
  deposit,
  blastingSessionOf,
  requestWithdraw,
  setWithdrawableFor,
  ownerAddress,
  withdrawable,
  withdraw,
  totalBlastingAmount,
  getWithdrawRequests,
  getBlastingSessionsOfPendingWithdrawRequests,
  changeBlastingAddress,
  ownerWithdraw,
  isPaused,
  unpause,
  FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY,
  MEDIUM_TIME_LOCK,
  REQUEST_WITHDRAW_TIMESTAMP_KEY,
  LONG_TIME_LOCK,
  setOwner,
  REQUEST_CHANGE_OWNER_TIMESTAMP_KEY,
  SHORT_TIME_LOCK,
} from '../contracts/blaster';
import {
  Context,
  mockAdminContext,
  changeCallStack,
  resetStorage,
  mockTransferredCoins,
  mockBalance,
  balanceOf,
  mockOriginOperationId,
  Storage,
} from '@massalabs/massa-as-sdk';
import { BlastingSession } from '../types/BlastingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawRequestEvent } from '../events/WithdrawRequestEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';
import { generateDumbAddress } from './test-utils';
import { withdrawRequestKey } from '../blaster-internal';
import { costOfKeyWithdrawable } from '../storage-cost';

const contractAddress = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';
const adminAddress = 'AU1mhPhXCfh8afoNnbW91bXUVAmu8wU7u8v54yNTMvY7E52KBbz3';
const blastingAddress = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1e1';
const userAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';
const userAddress2 = 'AU12e52VP4r3WYGUXonYSPX3njfJFevkKPBp4ru8sBjXnp14mSKJi';
const opId = 'O1uhe7LMJnS6t89MnQeqWSOIGlQ4enuY3bnlRITp55p03gVWw';
const opId2 = 'O18C3G7uIx9oXKtmfU3A0UThU7F4OHJRWfIii7JXjWEabYOVK';

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddress);
}

function callWithCoins(
  call: () => StaticArray<u8>,
  amount: u64,
): StaticArray<u8> {
  mockTransferredCoins(amount);
  mockBalance(
    contractAddress.toString(),
    balanceOf(contractAddress.toString()) + amount,
  );
  const result = call();
  mockTransferredCoins(0);
  return result;
}

function callSetWithdrawableAdmin(
  call: () => StaticArray<u8>,
  amount: u64,
): StaticArray<u8> {
  switchUser(adminAddress);
  amount += 17_900_000;
  mockBalance(
    contractAddress.toString(),
    balanceOf(contractAddress.toString()) + amount,
  );
  const result = callWithCoins(call, amount);
  switchUser(userAddress);
  return result;
}

beforeEach(() => {
  resetStorage();
  mockAdminContext(true);
  switchUser(adminAddress);
  constructor(new Args().add(blastingAddress.toString()).serialize());

  mockAdminContext(false);
  switchUser(userAddress);
  mockTransferredCoins(0);
  mockBalance(contractAddress.toString(), 0);
  mockBalance(userAddress.toString(), 0);
});

describe('constructor', () => {
  test('no write access', () => {
    expect(bytesToString(constructor([]))).toStrictEqual('Already deployed');
  });

  test('with write access', () => {
    mockAdminContext(true);
    switchUser(adminAddress);
    expect(
      constructor(new Args().add(blastingAddress.toString()).serialize()),
    ).toStrictEqual([]);
    expect(getBlastingAddress([])).toStrictEqual(
      stringToBytes(blastingAddress.toString()),
    );
    expect(ownerAddress([])).toStrictEqual(
      stringToBytes(adminAddress.toString()),
    );
  });
});

describe('deposit', () => {
  throws('error: minimum blasting amount', () => {
    mockTransferredCoins(200);
    const amountDeposit = 2_000_000 as u64 as u64;
    deposit(new Args().add(amountDeposit).serialize());
  });
  throws('error: minimum blasting amount, limit', () => {
    mockTransferredCoins(9_999_999_999);
    const amountDeposit = 9_999_999_999 as u64 as u64;
    deposit(new Args().add(amountDeposit).serialize());
  });
  throws('Blasting session already exists', () => {
    const amount = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amount).serialize());
    }, amount);
    callWithCoins(() => {
      return deposit(new Args().add(amount).serialize());
    }, amount);
  });
  test('deposit success', () => {
    // do
    const amount = 10_000_000_000 as u64;
    const result = callWithCoins(() => {
      return deposit(new Args().add(amount).serialize());
    }, amount);
    // fetch result
    const data = blastingSessionOf(new Args().add(userAddress).serialize());
    const blastingSession = new Args(data)
      .nextSerializable<BlastingSession>()
      .unwrap();
    // assert
    expect(Context.timestamp() - blastingSession.startTimestamp).toBeLessThan(
      2,
    );
    expect(blastingSession.withdrawRequestOpId).toStrictEqual('');
    expect(blastingSession.amount).toStrictEqual(amount);
    expect(blastingSession.userAddress).toStrictEqual(userAddress.toString());
    const resultEvent = new Args(result)
      .nextSerializable<DepositEvent>()
      .unwrap();
    expect(resultEvent.amount).toStrictEqual(amount);
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
    expect(resultEvent.timestamp).toStrictEqual(blastingSession.startTimestamp);
  });
});

describe('requestWithdraw', () => {
  throws('No blasting session found for the caller', () => {
    requestWithdraw([]);
  });
  throws('Withdraw request already exists for this user', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    expect(Storage.has(withdrawRequestKey(userAddress))).toStrictEqual(true);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(0));
    // User requests a withdraw a second time
    requestWithdraw([]);
  });
  throws('Not enough total blasting amount to decrease', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    expect(Storage.has(withdrawRequestKey(userAddress))).toStrictEqual(true);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(0));
    // admin send coins to withdraw
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    expect(Storage.has(withdrawRequestKey(userAddress))).toStrictEqual(false);
    // User requests a withdraw a second time
    requestWithdraw([]);
  });
  test('success', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
    // user requests a withdraw
    mockOriginOperationId(opId);
    const result = requestWithdraw([]);
    const resultEvent = new Args(result)
      .nextSerializable<WithdrawRequestEvent>()
      .unwrap();
    // assert
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(0));
    expect(Storage.has(withdrawRequestKey(userAddress))).toStrictEqual(true);
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
    const data = blastingSessionOf(new Args().add(userAddress).serialize());
    const blastingSession = new Args(data)
      .nextSerializable<BlastingSession>()
      .unwrap();
    expect(blastingSession.withdrawRequestOpId).toStrictEqual(opId);
    expect(Context.timestamp() - blastingSession.endTimestamp).toBeLessThan(2);
  });
});

describe('totalBlastingAmount', () => {
  test('empty', () => {
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(0));
  });
  test('one deposit', () => {
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
  });
  test('two deposits', () => {
    // deposit 1
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // deposit 2
    switchUser(userAddress2);
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // assert
    expect(totalBlastingAmount([])).toStrictEqual(
      u64ToBytes(amountDeposit * 2),
    );
  });
  test('two deposits and 0 request to withdraw', () => {
    // deposit 1
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // deposit 2
    switchUser(userAddress2);
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // user request withdraw
    requestWithdraw([]);
    // assert
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
  });
  throws('Exceeding max blasting amount', () => {
    const amountDeposit = 1_000_000_000_000_001 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
  });
});

describe('setWithdrawableFor', () => {
  throws('Caller is not the owner', () => {
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(100)).serialize(),
    );
  });
  throws('No withdraw request for this user', () => {
    switchUser(adminAddress);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(100)).serialize(),
    );
  });
  throws('operationId does not match the withdraw request', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // admin send coins to withdraw
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId2)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
  });
  throws('No withdraw request for this user.', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // admin send coins to withdraw
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
  });
  throws('Amount is less than the deposit.', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    mockOriginOperationId(opId);
    switchUser(userAddress);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor with less amount
    const amount = u64(5_000_000_300) as u64;
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args().add(userAddress).add(opId).add(u64(amount)).serialize(),
      );
    }, amount);
  });

  test('complex case', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    let withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // admin send coins to withdraw
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(0);
    // User can't requests a withdraw as second time
    switchUser(userAddress);
    expect(() => {
      requestWithdraw([]);
    }).toThrow(
      'should fail with: Withdraw request already exists for this user',
    );
    // admin can't send coins to withdraw
    expect(() => {
      callSetWithdrawableAdmin(() => {
        return setWithdrawableFor(
          new Args()
            .add(userAddress)
            .add(opId)
            .add(u64(amountDeposit))
            .serialize(),
        );
      }, amountDeposit);
    }).toThrow('should fail with: Withdrawable amount already set');
    // user withdraw
    switchUser(userAddress);
    withdraw([]);
    // admin still can't send coins to withdraw
    expect(() => {
      callSetWithdrawableAdmin(() => {
        return setWithdrawableFor(
          new Args()
            .add(userAddress)
            .add(opId)
            .add(u64(amountDeposit))
            .serialize(),
        );
      }, amountDeposit);
    }).toThrow('should fail with: No withdraw request for this user');
    mockTransferredCoins(0);
    // User can't ask for withdraw if no deposit
    switchUser(userAddress);
    expect(() => {
      requestWithdraw([]);
    }).toThrow('should fail with: No blasting session found for the caller');

    // User deposit 1
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // User deposit 2
    switchUser(userAddress2);
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(2);
    const blastingSessions = new Args(
      getBlastingSessionsOfPendingWithdrawRequests([]),
    )
      .nextSerializableObjectArray<BlastingSession>()
      .expect('should be a list of blasting sessions');
    expect(blastingSessions.length).toStrictEqual(2);
    // admin send coins to withdraw for user 2
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress2)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // admin send coins to withdraw for user 1
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextStringArray()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(0);
  });

  test('success', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    mockOriginOperationId(opId);
    switchUser(userAddress);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor with less amount
    const result = callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    // assert
    const resultEvent = new Args(result)
      .nextSerializable<SetWithdrawableEvent>()
      .unwrap();
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
    expect(resultEvent.amount).toStrictEqual(amountDeposit);

    // check consequences
    const data = withdrawable(new Args().add(userAddress).serialize());
    const resultAmount = new Args(data).nextU64().unwrap();
    expect(resultAmount).toStrictEqual(amountDeposit);
  });
});

describe('withdrawable', () => {
  test('random address', () => {
    const data = withdrawable(
      new Args().add(generateDumbAddress()).serialize(),
    );
    const resultAmount = new Args(data).nextU64().unwrap();
    expect(resultAmount).toStrictEqual(0);
  });
});

describe('withdraw', () => {
  throws('not enough balance in the contract to withdraw', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }, amountDeposit);
    // Fake the contract balance
    mockBalance(contractAddress.toString(), 0);
    // test
    switchUser(userAddress);
    withdraw([]);
  });

  test('success', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000 as u64;
    mockBalance(contractAddress.toString(), 0);
    callWithCoins(() => {
      return deposit(new Args().add(amountDeposit).serialize());
    }, amountDeposit);
    expect(balanceOf(blastingAddress.toString())).toStrictEqual(amountDeposit);
    expect(balanceOf(contractAddress.toString())).toStrictEqual(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor
    const amount = u64(11_000_200_000) as u64;
    callSetWithdrawableAdmin(() => {
      return setWithdrawableFor(
        new Args().add(userAddress).add(opId).add(u64(amount)).serialize(),
      );
    }, amount);
    // check that the amount is set
    let data = withdrawable(new Args().add(userAddress).serialize());
    const resultAmount = new Args(data).nextU64().unwrap();
    expect(resultAmount).toStrictEqual(amount);

    // test
    switchUser(userAddress);
    const balanceBefore = balanceOf(userAddress.toString());
    const costWithdrawable = costOfKeyWithdrawable(userAddress);
    mockTransferredCoins(costWithdrawable);
    withdraw([]);
    mockTransferredCoins(0);
    const balanceAfter = balanceOf(userAddress.toString());

    // assert
    expect(data).toStrictEqual(u64ToBytes(amount));
    expect(balanceAfter - balanceBefore).toStrictEqual(amount);
  });
});

describe('blastingSessionOf', () => {
  test('random address', () => {
    const data = blastingSessionOf(
      new Args().add(generateDumbAddress()).serialize(),
    );
    expect(data).toStrictEqual([]);
  });
});

describe('changeBlastingAddress', () => {
  throws('Caller is not the owner', () => {
    const newBlastingAddress =
      'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1e2';
    changeBlastingAddress(new Args().add(newBlastingAddress).serialize());
  });
  test('success', () => {
    switchUser(adminAddress);
    const newBlastingAddress =
      'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1e2';
    changeBlastingAddress(new Args().add(newBlastingAddress).serialize());
    const data = getBlastingAddress([]);
    expect(data).toStrictEqual(stringToBytes(newBlastingAddress));
    expect(byteToBool(isPaused([]))).toStrictEqual(true);
    expect(() => {
      unpause([]);
    }).toThrow('should fail with: with force pause');
  });
});

describe('pause', () => {});
describe('unpause', () => {
  throws('Caller is not the owner', () => {
    unpause([]);
  });
  test('success', () => {
    switchUser(adminAddress);
    unpause([]);
    expect(byteToBool(isPaused([]))).toStrictEqual(false);
  });
  throws('with force pause', () => {
    switchUser(adminAddress);
    Storage.set(
      FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp()),
    );
    unpause([]);
  });
  test('with force pause old', () => {
    switchUser(adminAddress);
    Storage.set(
      FORCE_PAUSE_DEPOSIT_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp() - MEDIUM_TIME_LOCK - 1),
    );
    unpause([]);
    expect(byteToBool(isPaused([]))).toStrictEqual(false);
  });
});

describe('ownerWithdraw', () => {
  throws('Caller is not the owner', () => {
    ownerWithdraw([]);
  });
  test('success', () => {
    switchUser(adminAddress);
    mockBalance(contractAddress.toString(), 10_000_000_000);
    ownerWithdraw([]);
    expect(balanceOf(contractAddress.toString())).toStrictEqual(10_000_000_000); // no withdraw
    // fake the time lock start time
    Storage.set(
      REQUEST_WITHDRAW_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp() - LONG_TIME_LOCK - 1),
    );
    ownerWithdraw([]);
    expect(balanceOf(contractAddress.toString())).toStrictEqual(0);
  });
});

describe('setOwner', () => {
  throws('Caller is not the owner', () => {
    setOwner([]);
  });
  test('success', () => {
    switchUser(adminAddress);
    const newOwner = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';
    setOwner(new Args().add(newOwner).serialize());
    expect(bytesToString(ownerAddress([]))).toStrictEqual(adminAddress); // stays the same
    // fake the time lock start time
    Storage.set(
      REQUEST_CHANGE_OWNER_TIMESTAMP_KEY,
      u64ToBytes(Context.timestamp() - SHORT_TIME_LOCK - 1),
    );
    setOwner(new Args().add(newOwner).serialize());
    expect(bytesToString(ownerAddress([]))).toStrictEqual(newOwner); // stays the same
  });
});
