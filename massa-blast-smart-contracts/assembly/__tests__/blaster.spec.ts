import {
  Args,
  bytesToString,
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
} from '../contracts/blaster';
import {
  Address,
  Context,
  mockAdminContext,
  changeCallStack,
  resetStorage,
  mockTransferredCoins,
  mockBalance,
  balanceOf,
  mockOriginOperationId,
} from '@massalabs/massa-as-sdk';
import { BlastingSession } from '../types/BlastingSession';
import { DepositEvent } from '../events/DepositEvent';
import { WithdrawEvent } from '../events/WithdrawEvent';
import { SetWithdrawableEvent } from '../events/SetWithdrawableEvent';
import { generateDumbAddress } from './test-utils';

const contractAddress = new Address(
  'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT',
);
const adminAddress = new Address(
  'AU1mhPhXCfh8afoNnbW91bXUVAmu8wU7u8v54yNTMvY7E52KBbz3',
);
const blastingAddress = new Address(
  'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1e1',
);
const userAddress = new Address(
  'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
);
const userAddress2 = new Address(
  'AU12e52VP4r3WYGUXonYSPX3njfJFevkKPBp4ru8sBjXnp14mSKJi',
);

const opId = 'O1uhe7LMJnS6t89MnQeqWSOIGlQ4enuY3bnlRITp55p03gVWw';
const opId2 = 'O18C3G7uIx9oXKtmfU3A0UThU7F4OHJRWfIii7JXjWEabYOVK';

function switchUser(user: Address): void {
  changeCallStack(user.toString() + ' , ' + contractAddress.toString());
}

beforeEach(() => {
  resetStorage();
  mockAdminContext(true);
  switchUser(adminAddress);
  constructor(new Args().add(blastingAddress).serialize());

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
      constructor(new Args().add(blastingAddress).serialize()),
    ).toStrictEqual([]);
    expect(getBlastingAddress([])).toStrictEqual(
      new Args().add(blastingAddress).serialize(),
    );
    expect(ownerAddress([])).toStrictEqual(
      stringToBytes(adminAddress.toString()),
    );
  });
});

describe('deposit', () => {
  test('error: minimum blasting amount', () => {
    mockTransferredCoins(200);
    expect(() => {
      const amountDeposit = 2_000_000;
      deposit(new Args().add(amountDeposit).serialize());
    }).toThrow();
  });
  test('error: minimum blasting amount, limit', () => {
    mockTransferredCoins(9_999_999_999);
    expect(() => {
      deposit([]);
    }).toThrow();
  });
  throws('Blasting session already exists', () => {
    const amount = 10_000_000_000;
    mockTransferredCoins(amount);
    deposit([]);
    deposit([]);
  });
  test('deposit success', () => {
    // do
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    const result = deposit(new Args().add(amountDeposit).serialize());
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
    expect(blastingSession.amount).toStrictEqual(amountDeposit);
    expect(blastingSession.userAddress).toStrictEqual(userAddress.toString());
    const resultEvent = new Args(result)
      .nextSerializable<DepositEvent>()
      .unwrap();
    expect(resultEvent.amount).toStrictEqual(amountDeposit);
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
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // admin send coins to withdraw
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(amountDeposit)).serialize(),
    );
    mockTransferredCoins(0);
    // User requests a withdraw as second time
    switchUser(userAddress);
    requestWithdraw([]);
  });
  test('success', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // user requests a withdraw
    mockOriginOperationId(opId);
    const result = requestWithdraw([]);
    const resultEvent = new Args(result)
      .nextSerializable<WithdrawEvent>()
      .unwrap();
    // assert
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
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
  });
  test('two deposits', () => {
    // deposit 1
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // deposit 2
    mockTransferredCoins(amountDeposit);
    switchUser(userAddress2);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // assert
    expect(totalBlastingAmount([])).toStrictEqual(
      u64ToBytes(amountDeposit * 2),
    );
  });
  test('two deposits and 0 request to withdraw', () => {
    // deposit 1
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // deposit 2
    mockTransferredCoins(amountDeposit);
    switchUser(userAddress2);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // user request withdraw
    requestWithdraw([]);
    // assert
    expect(totalBlastingAmount([])).toStrictEqual(u64ToBytes(amountDeposit));
  });
  throws('Exceeding max blasting amount', () => {
    const amountDeposit = 1_000_000_000_000_001;
    mockBalance(userAddress.toString(), amountDeposit * 2);
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
  });
});

describe('setWithdrawableFor', () => {
  throws('no owner', () => {
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
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // admin send coins to withdraw
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args()
        .add(userAddress)
        .add(opId2) // should fail
        .add(u64(amountDeposit))
        .serialize(),
    );
  });
  throws('Withdrawable amount already set', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    requestWithdraw([]);
    // admin send coins to withdraw
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(amountDeposit)).serialize(),
    );
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(amountDeposit)).serialize(),
    );
  });
  test('complex case', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    let withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // admin send coins to withdraw
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(amountDeposit)).serialize(),
    );
    mockBalance(contractAddress.toString(), amountDeposit);
    mockTransferredCoins(0);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
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
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    expect(() => {
      setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }).toThrow('should fail with: Withdrawable amount already set');
    mockTransferredCoins(0);
    // user withdraw
    switchUser(userAddress);
    withdraw([]);
    // admin still can't send coins to withdraw
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    expect(() => {
      setWithdrawableFor(
        new Args()
          .add(userAddress)
          .add(opId)
          .add(u64(amountDeposit))
          .serialize(),
      );
    }).toThrow('should fail with: No withdraw request for this user');
    mockTransferredCoins(0);
    // User can't ask for withdraw if no deposit
    switchUser(userAddress);
    expect(() => {
      requestWithdraw([]);
    }).toThrow('should fail with: No blasting session found for the caller');

    // User deposit 1
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // User deposit 2
    switchUser(userAddress2);
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    requestWithdraw([]);
    /// assert that the withdraw request is set
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(2);
    const blastingSessions = new Args(
      getBlastingSessionsOfPendingWithdrawRequests([]),
    )
      .nextSerializableObjectArray<BlastingSession>()
      .expect('should be a list of blasting sessions');
    expect(blastingSessions.length).toStrictEqual(2);
    // admin send coins to withdraw for user 2
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args()
        .add(userAddress2)
        .add(opId)
        .add(u64(amountDeposit))
        .serialize(),
    );
    mockBalance(contractAddress.toString(), amountDeposit);
    mockTransferredCoins(0);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(1);
    // admin send coins to withdraw for user 1
    switchUser(adminAddress);
    mockTransferredCoins(amountDeposit);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(u64(amountDeposit)).serialize(),
    );
    mockBalance(contractAddress.toString(), amountDeposit);
    mockTransferredCoins(0);
    /// assert that the withdraw request is removed
    withdrawRequests = new Args(getWithdrawRequests([]))
      .nextSerializableObjectArray<Address>()
      .unwrap();
    expect(withdrawRequests.length).toStrictEqual(0);
  });

  test('owner', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    switchUser(userAddress);
    requestWithdraw([]);
    // prepare admin call
    switchUser(adminAddress);
    const amount = u64(5_000_000_300);
    mockBalance(adminAddress.toString(), amount);

    // do: Admin calls setWithdrawableFor
    mockTransferredCoins(amount);
    const result = setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(amount).serialize(),
    );
    mockTransferredCoins(0);

    // assert
    const resultEvent = new Args(result)
      .nextSerializable<SetWithdrawableEvent>()
      .unwrap();
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
    expect(resultEvent.amount).toStrictEqual(amount);

    // check consequences
    switchUser(userAddress);
    const data = withdrawable(new Args().add(userAddress).serialize());
    const resultAmount = new Args(data).nextU64().unwrap();
    expect(resultAmount).toStrictEqual(amount);
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
  test('random address', () => {
    switchUser(new Address(generateDumbAddress()));
    expect(() => {
      withdraw([]);
    }).toThrow();
  });

  test('not enough amount to withdraw', () => {
    expect(() => {
      withdraw([]);
    }).toThrow();
  });

  test('not enough balance in the contract to withdraw', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    switchUser(userAddress);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor
    switchUser(adminAddress);
    const amount = u64(15_000_080_000);
    mockBalance(adminAddress.toString(), amount);
    mockTransferredCoins(amount);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(amount).serialize(),
    );
    mockTransferredCoins(0);

    // test
    switchUser(userAddress);
    expect(() => {
      withdraw([]);
    }).toThrow();
  });

  test('success', () => {
    // prepare
    // User deposit
    const amountDeposit = 10_000_000_000;
    mockTransferredCoins(amountDeposit);
    deposit(new Args().add(amountDeposit).serialize());
    mockTransferredCoins(0);
    // User requests a withdraw
    mockOriginOperationId(opId);
    switchUser(userAddress);
    requestWithdraw([]);
    // Admin calls setWithdrawableFor
    switchUser(adminAddress);
    const amount = u64(11_000_200_000);
    mockBalance(adminAddress.toString(), amount);
    mockTransferredCoins(amount);
    setWithdrawableFor(
      new Args().add(userAddress).add(opId).add(amount).serialize(),
    );
    mockTransferredCoins(0); // reset transferred coins

    // check that the amount is set
    // mock contract balance because mockTransferredCoins don't credit the contract:
    mockBalance(contractAddress.toString(), amount);
    expect(balanceOf(contractAddress.toString())).toStrictEqual(amount);
    let data = withdrawable(new Args().add(userAddress).serialize());
    const resultAmount = new Args(data).nextU64().unwrap();
    expect(resultAmount).toStrictEqual(amount);

    // test
    switchUser(userAddress);
    data = withdraw([]);

    // assert
    expect(data).toStrictEqual(u64ToBytes(amount));
    expect(balanceOf(userAddress.toString())).toStrictEqual(amount);
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
