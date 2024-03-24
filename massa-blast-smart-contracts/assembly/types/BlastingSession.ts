import { Args, Serializable, Result } from '@massalabs/as-types';

export class BlastingSession implements Serializable {
  constructor(
    public startTimestamp: u64 = 0,
    public amount: u64 = 0,
    public userAddress: string = '',
    public withdrawRequestOpId: string = '',
    public endTimestamp: u64 = 0,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.startTimestamp)
      .add(this.amount)
      .add(this.userAddress)
      .add(this.withdrawRequestOpId)
      .add(this.endTimestamp)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    const resultStartTimestamp = args.nextU64();

    if (resultStartTimestamp.isErr()) {
      return new Result(0, "Can't deserialize startTimestamp.");
    }

    const resultAmount = args.nextU64();

    if (resultAmount.isErr()) {
      return new Result(0, "Can't deserialize amount.");
    }

    const resultUserAddress = args.nextString();

    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }

    const resultWithdrawRequestOpId = args.nextString();

    if (resultWithdrawRequestOpId.isErr()) {
      return new Result(0, "Can't deserialize withdrawRequestOpId.");
    }

    const resultEndTimestamp = args.nextU64();

    if (resultEndTimestamp.isErr()) {
      return new Result(0, "Can't deserialize endTimestamp.");
    }

    this.startTimestamp = resultStartTimestamp.unwrap();
    this.amount = resultAmount.unwrap();
    this.userAddress = resultUserAddress.unwrap();
    this.withdrawRequestOpId = resultWithdrawRequestOpId.unwrap();
    this.endTimestamp = resultEndTimestamp.unwrap();

    return new Result(args.offset);
  }
}
