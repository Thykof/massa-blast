export const SC_ADDRESS = import.meta.env.VITE_SC_ADDRESS;

let defaultOpFees: bigint;
try {
  defaultOpFees = BigInt(import.meta.env.VITE_OP_FEES);
} catch (error) {
  console.error('Failed to parse VITE_OP_FEES', error);
  defaultOpFees = BigInt(0);
}
export const DEFAULT_OP_FEES = defaultOpFees;
