import { WITHDRAWABLE_KEY, withdrawRequestKey } from './blaster-internal';

const STORAGE_BYTE_COST: u64 = 100_000;

// Cost of a requestWithdraw operation
export function costOfRequestWithdraw(
  caller: string,
  withdrawRequestOpId: string,
): u64 {
  return (
    costOfAddWithdrawRequest(caller, withdrawRequestOpId) * STORAGE_BYTE_COST
  );
}

function costOfAddWithdrawRequest(
  caller: string,
  withdrawRequestOpId: string,
): u64 {
  const keyCost = 4 + withdrawRequestKey(caller).length;
  return (
    keyCost + withdrawRequestOpId.length + costOfPushWithdrawRequest(caller)
  );
}

function costOfPushWithdrawRequest(caller: string): u64 {
  return 4 + caller.length;
}

// Cost of keyWithdrawable
export function costOfKeyWithdrawable(userAddress: string): u64 {
  const keyCost = 4 + WITHDRAWABLE_KEY.length + userAddress.length;
  return (keyCost + 8) * STORAGE_BYTE_COST;
}
