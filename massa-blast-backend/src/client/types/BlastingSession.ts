import {
  ISerializable,
  IDeserializedResult,
  Args,
} from '@massalabs/massa-web3';

export class BlastingSession implements ISerializable<BlastingSession> {
  constructor(
    public startTimestamp: bigint = 0n,
    public amount: bigint = 0n,
    public userAddress: string = '',
    public withdrawRequestOpId: string = '',
    public endTimestamp: bigint = 0n,
  ) {}

  serialize(): Uint8Array {
    throw new Error('BlastingSession::serialize is not implemented');
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
