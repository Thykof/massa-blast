import { Args, bytesToU64, Client } from '@massalabs/massa-web3';
import { SC_ADDRESS } from '../const/sc';
import { BlastingSession } from '../types/BlastingSession';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAmount } from './parseAmount';

export function useReadBlastingSession(massaClient?: Client, address?: string) {
  const [session, setSession] = useState<BlastingSession>();

  const refetch = useCallback(() => {
    if (address) {
      getBlastingSession(address, massaClient).then((s) => setSession(s));
    }
  }, [address, massaClient]);

  // trick to avoid infinite loop
  // we don't want to refetch on every render
  useMemo(() => {
    refetch();
  }, [refetch]);

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

export function useReadWithdrawable(massaClient?: Client, address?: string) {
  const [withdrawable, setWithdrawable] = useState<bigint>();

  const refetch = useCallback(() => {
    if (address) {
      getWithdrawable(address, massaClient).then((w) => setWithdrawable(w));
    }
  }, [address, massaClient]);

  useMemo(() => {
    refetch();
  }, [refetch]);

  return {
    withdrawable,
    refetch,
  };
}

async function getWithdrawable(
  address: string,
  massaClient?: Client,
): Promise<bigint | undefined> {
  if (!massaClient) {
    return undefined;
  }
  const res = await massaClient.smartContracts().readSmartContract({
    targetAddress: SC_ADDRESS,
    targetFunction: 'withdrawable',
    parameter: new Args().addString(address),
  });

  if (res.returnValue === undefined || !res.returnValue.length) {
    return undefined;
  }

  return bytesToU64(res.returnValue);
}

export function useTotalAmount(massaClient?: Client) {
  const [totalAmount, setTotalAmount] = useState<string>();

  useEffect(() => {
    getTotalAmount(massaClient).then((s) => {
      if (s !== undefined) {
        setTotalAmount(formatAmount(s.toString()).amountFormattedFull);
      } else {
        setTotalAmount(undefined);
      }
    });
  });

  return { totalAmount };
}

async function getTotalAmount(
  massaClient?: Client,
): Promise<bigint | undefined> {
  if (!massaClient) {
    return undefined;
  }

  const res = await massaClient.smartContracts().readSmartContract({
    targetAddress: SC_ADDRESS,
    targetFunction: 'totalBlastingAmount',
    parameter: [],
  });

  return bytesToU64(res.returnValue);
}
