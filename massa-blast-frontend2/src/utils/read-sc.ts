import { Args, bytesToU64, Client } from '@massalabs/massa-web3';
import { SC_ADDRESS } from '../const/sc';
import { BlastingSession } from '../types/BlastingSession';
import { useCallback, useEffect, useState } from 'react';
import { formatAmount } from './parseAmount';

export function useReadBlastingSession(massaClient?: Client, address?: string) {
  const [session, setSession] = useState<BlastingSession>();

  const refetch = useCallback(() => {
    if (address) {
      getBlastingSession(address, massaClient).then((s) => setSession(s));
    }
  }, [address, massaClient]);

  refetch();

  return {
    session,
    refetch,
  };
}

async function getBlastingSession(
  address: string,
  massaClient?: Client,
): Promise<BlastingSession | undefined> {
  if (!massaClient) {
    return undefined;
  }
  const res = await massaClient.smartContracts().readSmartContract({
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

export function useTotalAmount(massaClient?: Client) {
  const [totalAmount, setTotalAmount] = useState<string>();

  useEffect(() => {
    getTotalAmount(massaClient).then((s) =>
      setTotalAmount(formatAmount(s.toString()).amountFormattedFull),
    );
  });

  return { totalAmount };
}

async function getTotalAmount(massaClient?: Client): Promise<bigint> {
  if (!massaClient) {
    return BigInt(0);
  }

  const res = await massaClient.smartContracts().readSmartContract({
    targetAddress: SC_ADDRESS,
    targetFunction: 'totalBlastingAmount',
    parameter: [],
  });

  return bytesToU64(res.returnValue);
}
