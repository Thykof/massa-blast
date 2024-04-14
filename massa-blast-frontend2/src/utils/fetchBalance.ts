import { toast } from '@massalabs/react-ui-kit';
import { IAccount, IAccountBalanceResponse } from '@massalabs/wallet-provider';
import Intl from '../i18n/i18n';
import { useEffect, useState } from 'react';

export function useBalance(account?: IAccount) {
  const [balance, setBalance] = useState<string>();

  useEffect(() => {
    if (!account) return;
    fetchMASBalance(account).then((b) => setBalance(b.finalBalance));
  });

  return balance;
}

export async function fetchMASBalance(
  account: IAccount,
): Promise<IAccountBalanceResponse> {
  try {
    return account.balance();
  } catch (error) {
    console.error('Error while retrieving balance: ', error);
    toast.error(Intl.t('index.balance.error'));
    return { finalBalance: '0', candidateBalance: '0' };
  }
}
