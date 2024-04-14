import {
  Args,
  IDeserializedResult,
  ISerializable,
} from '@massalabs/massa-web3';

export class BlastingSession implements ISerializable<BlastingSession> {
  constructor(
    public startTimestamp: bigint = 0,
    public amount: bigint = 0,
    public userAddress: string = '',
    public withdrawRequestOpId: string = '',
    public endTimestamp: bigint = 0,
  ) {}

  serialize(): Uint8Array {
    return new Uint8Array(
      new Args()
        .addU256(this.startTimestamp)
        .addU256(this.amount)
        .addString(this.userAddress)
        .addString(this.withdrawRequestOpId)
        .addU256(this.endTimestamp)
        .serialize(),
    );
  }

  deserialize(
    data: Uint8Array,
    offset: number,
  ): IDeserializedResult<BlastingSession> {
    const args = new Args(data, offset);
    this.startTimestamp = args.nextU64();
    this.amount = args.nextU64();
    this.userAddress = args.nextString();
    this.withdrawRequestOpId = args.nextString();
    this.endTimestamp = args.nextU64();

    return { instance: this, offset: args.getOffset() };
  }
}
