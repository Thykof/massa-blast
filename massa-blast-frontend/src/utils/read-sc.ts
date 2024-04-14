import { Args, bytesToU64 } from '@massalabs/massa-web3';
import { SC_ADDRESS } from '../const/sc';
import { BlastingSession } from '../types/BlastingSession';
import { useCallback, useEffect, useState } from 'react';
import { formatAmount } from './parseAmount';

export function useReadBlastingSession(address?: string) {
  const [session, setSession] = useState<BlastingSession>();

  const refetch = useCallback(() => {
    if (address) {
      getBlastingSession(address).then((s) => setSession(s));
    }
  }, [address]);

  refetch();

  return {
    session,
    refetch,
  };
}

async function getBlastingSession(
  address: string,
): Promise<BlastingSession | undefined> {
  const res = await client.smartContracts().readSmartContract({
    targetAddress: SC_ADDRESS,
    targetFunction: 'blastingSessionOf',
    parameter: new Args().addString(address),
  });

  if (res.returnValue === undefined || !res.returnValue.length) {
    return undefined;
  }

  const session = new BlastingSession();
  session.deserialize(res.returnValue, 0);

  return session;
}

export function useTotalAmount() {
  const [totalAmount, setTotalAmount] = useState<string>();

  useEffect(() => {
    getTotalAmount().then((s) =>
      setTotalAmount(formatAmount(s.toString()).amountFormattedFull),
    );
  });

  return { totalAmount };
}

async function getTotalAmount(): Promise<bigint> {
  const res = await client.smartContracts().readSmartContract({
    targetAddress: SC_ADDRESS,
    targetFunction: 'totalBlastingAmount',
  });

  return bytesToU64(res.returnValue);
}
