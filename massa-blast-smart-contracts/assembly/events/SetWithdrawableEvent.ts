import { Args, Result } from '@massalabs/as-types';

export class SetWithdrawableEvent {
  constructor(public userAddress: string = '', public amount: u64 = 0) {}

  toJson(): string {
    return `{
    "type": "SetWithdrawableEvent",
    "userAddress": "${this.userAddress.toString()}",
    "amount": "${this.amount.toString()}"
    }`;
  }

  serialize(): StaticArray<u8> {
    return new Args().add(this.userAddress).add(this.amount).serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const resultUserAddress = args.nextString();
    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }
    this.userAddress = resultUserAddress.unwrap();

    const resultAmount = args.nextU64();
    if (resultAmount.isErr()) {
      return new Result(0, "Can't deserialize amount.");
    }

    this.amount = resultAmount.unwrap();

    return new Result(args.offset);
  }
}
