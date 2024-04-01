import { Args, Result, Serializable } from '@massalabs/as-types';

export class DepositEvent implements Serializable {
  constructor(
    public amount: u64 = 0,
    public userAddress: string = '',
    public timestamp: u64 = 0,
  ) {}

  toJson(): string {
    return `{
    "type": "DepositEvent",
    "amount": "${this.amount}",
    "userAddress": "${this.userAddress.toString()}",
    "timestamp": "${this.timestamp.toString()}"
    }`;
  }

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.amount)
      .add(this.userAddress)
      .add(this.timestamp)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const resultAmount = args.nextU64();
    if (resultAmount.isErr()) {
      return new Result(0, "Can't deserialize amount.");
    }
    this.amount = resultAmount.unwrap();

    const resultUserAddress = args.nextString();
    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }
    this.userAddress = resultUserAddress.unwrap();

    const resultTimestamp = args.nextU64();
    if (resultTimestamp.isErr()) {
      return new Result(0, "Can't deserialize timestamp.");
    }
    this.timestamp = resultTimestamp.unwrap();

    return new Result(args.offset);
  }
}
