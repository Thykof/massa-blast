import {
  Args,
  bytesToString,
  stringToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  constructor,
  getStackingAddress,
  deposit,
  stackingSessionOf,
  requestWithdraw,
  setWithdrawableFor,
  ownerAddress,
  withdrawable,
  withdraw,
} from '../contracts/massa-deleg';
import {
  Address,
  Context,
  mockAdminContext,
  changeCallStack,
  resetStorage,
  mockTransferredCoins,
  mockBalance,
  balanceOf,
} from '@massalabs/massa-as-sdk';
import { StackingSession } from '../types/StackingSession';
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
const stackingAddress = new Address(
  'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1e1',
);
const userAddress = new Address(
  'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
);

function switchUser(user: Address): void {
  changeCallStack(user.toString() + ' , ' + contractAddress.toString());
}

beforeEach(() => {
  resetStorage();
  mockAdminContext(true);
  switchUser(adminAddress);
  constructor(new Args().add(stackingAddress).serialize());

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
      constructor(new Args().add(stackingAddress).serialize()),
    ).toStrictEqual([]);
    expect(getStackingAddress([])).toStrictEqual(
      new Args().add(stackingAddress).serialize(),
    );
    expect(ownerAddress([])).toStrictEqual(
      stringToBytes(adminAddress.toString()),
    );
  });
});

describe('deposit', () => {
  test('error: minimum stacking amount', () => {
    mockTransferredCoins(200);
    expect(() => {
      deposit([]);
    }).toThrow();
  });
  test('error: minimum stacking amount, limit', () => {
    mockTransferredCoins(9_999_999_999);
    expect(() => {
      deposit([]);
    }).toThrow();
  });
  test('deposit success', () => {
    const amount = 10_000_000_000;
    mockTransferredCoins(amount);
    const result = deposit([]);
    const data = stackingSessionOf(new Args().add(userAddress).serialize());
    const stackingSession = new Args(data)
      .nextSerializable<StackingSession>()
      .unwrap();
    expect(Context.timestamp() - stackingSession.startTimestamp).toBeLessThan(
      2,
    );
    expect(stackingSession.amount).toStrictEqual(amount);
    expect(stackingSession.userAddress).toStrictEqual(userAddress);
    const resultEvent = new Args(result)
      .nextSerializable<DepositEvent>()
      .unwrap();
    expect(resultEvent.amount).toStrictEqual(amount);
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
    expect(resultEvent.timestamp).toStrictEqual(stackingSession.startTimestamp);
  });
});

describe('requestWithdraw', () => {
  test('requestWithdraw success', () => {
    const result = requestWithdraw([]);
    const resultEvent = new Args(result)
      .nextSerializable<WithdrawEvent>()
      .unwrap();
    expect(resultEvent.userAddress).toStrictEqual(userAddress);
  });
});

describe('setWithdrawableFor', () => {
  test('no owner', () => {
    expect(() => {
      setWithdrawableFor(new Args().add(userAddress).serialize());
    }).toThrow();
  });

  test('no transferer coins', () => {
    switchUser(adminAddress);
    expect(() => {
      setWithdrawableFor(new Args().add(userAddress).serialize());
    }).toThrow();
  });

  test('owner', () => {
    // prepare
    switchUser(adminAddress);
    const amount = u64(5_000_000_300);
    mockBalance(adminAddress.toString(), amount);

    // do
    mockTransferredCoins(amount);
    const result = setWithdrawableFor(
      new Args().add(userAddress).add(amount).serialize(),
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

  test('withdraw amount too low', () => {
    // prepare
    switchUser(adminAddress);
    const amount = u64(5_000_001_000);
    mockBalance(adminAddress.toString(), amount);
    mockTransferredCoins(amount);
    setWithdrawableFor(new Args().add(userAddress).serialize());
    mockTransferredCoins(0);

    // test
    switchUser(userAddress);
    expect(() => {
      withdraw([]);
    }).toThrow();
  });

  test('not enough balance in the contract to withdraw', () => {
    // prepare
    switchUser(adminAddress);
    const amount = u64(15_000_080_000);
    mockBalance(adminAddress.toString(), amount);
    mockTransferredCoins(amount);
    setWithdrawableFor(new Args().add(userAddress).serialize());
    mockTransferredCoins(0);

    // test
    switchUser(userAddress);
    expect(() => {
      withdraw([]);
    }).toThrow();
  });

  test('success', () => {
    // prepare: admin calls setWithdrawableFor
    switchUser(adminAddress);
    const amount = u64(11_000_200_000);
    mockBalance(adminAddress.toString(), amount);
    mockTransferredCoins(amount);
    setWithdrawableFor(new Args().add(userAddress).serialize());
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

describe('stackingSessionOf', () => {
  test('random address', () => {
    const data = stackingSessionOf(
      new Args().add(generateDumbAddress()).serialize(),
    );
    expect(data).toStrictEqual([]);
  });
});
