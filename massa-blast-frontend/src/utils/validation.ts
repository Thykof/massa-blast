import { Address, fromMAS } from '@massalabs/massa-web3';

export const validateAmount = (amount: string) => {
  if (!amount) {
    return 'Amount is required';
  }

  let amountInMAS = BigInt(0);
  try {
    amountInMAS = fromMAS(amount);
  } catch (e) {
    return 'Invalid amount';
  }

  if (amountInMAS <= 0n) {
    return 'Amount must be greater than 0';
  }

  return undefined;
};
