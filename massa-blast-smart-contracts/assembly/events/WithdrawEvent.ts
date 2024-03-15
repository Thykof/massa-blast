import { Args, Result } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';

export class WithdrawEvent {
  constructor(public userAddress: Address = new Address()) {}

  toJson(): string {
    return `{
    "type":"WithdrawEvent",
    "userAddress":"${this.userAddress.toString()}"
    }`;
  }

  serialize(): StaticArray<u8> {
    return new Args().add(this.userAddress).serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    const resultUserAddress = args.nextSerializable<Address>();
    if (resultUserAddress.isErr()) {
      return new Result(0, "Can't deserialize userAddress.");
    }

    this.userAddress = resultUserAddress.unwrap();

    return new Result(args.offset);
  }
}
