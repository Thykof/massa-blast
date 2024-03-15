import { Address } from '@massalabs/massa-as-sdk';
import { Args, Serializable, Result } from '@massalabs/as-types';

export class BlastingSession implements Serializable {
  constructor(
    public startTimestamp: u64 = 0,
    public amount: u64 = 0,
    public userAddress: Address = new Address(),
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.startTimestamp)
      .add(this.amount)
      .add(this.userAddress)
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

    const resultUserAddress = args.nextSerializable<Address>();

    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }

    this.startTimestamp = resultStartTimestamp.unwrap();
    this.amount = resultAmount.unwrap();
    this.userAddress = resultUserAddress.unwrap();

    return new Result(args.offset);
  }
}
