import { Args, Result, Serializable } from '@massalabs/as-types';

export class WithdrawnEvent implements Serializable {
  constructor(
    public userAddress: string = '',
    public withdrawnAmount: u64 = 0,
  ) {}

  toJson(): string {
    return `{
    "type":"WithdrawnEvent",
    "userAddress":"${this.userAddress.toString()}",
    "withdrawnAmount":"${this.withdrawnAmount.toString()}"
    }`;
  }

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.userAddress)
      .add(this.withdrawnAmount)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const resultUserAddress = args.nextString();
    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }
    this.userAddress = resultUserAddress.unwrap();

    const resultWithdrawnAmount = args.nextU64();
    if (resultWithdrawnAmount.isErr()) {
      return new Result(0, "Can't deserialize withdrawnAmount.");
    }
    this.withdrawnAmount = resultWithdrawnAmount.unwrap();

    return new Result(args.offset);
  }
}
