import { Button, Money, Spinner } from '@massalabs/react-ui-kit';
import { DEPOSIT_STORAGE_COST, useWrite } from '../../utils/write-sc';
import { useEffect, useState } from 'react';
import { fromMAS, toMAS } from '@massalabs/massa-web3';
import { useAccountStore } from '../../store';
import { useBalance } from '../../utils/fetchBalance';
import Intl from '../../i18n/i18n';
import { generateExplorerLink } from '../../utils/massa-utils';

const MINIMAL_DEPOSIT = 10_000_000_000n;

export function Deposit(props: { refetch: () => void }) {
  const { refetch } = props;
  const { connectedAccount, massaClient } = useAccountStore();
  const balance = useBalance(connectedAccount);
  const { opId, isPending, isSuccess, deposit } = useWrite(massaClient);

  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSuccess) {
      refetch();
    }
  }, [isSuccess, refetch]);

  function handleSetAmount(value: string) {
    setError('');
    const newAmount = value.replace(/[^0-9.-]/g, ''); // Remove non-numeric characters

    setAmount(newAmount);
  }

  function handleSubmit() {
    if (!amount) {
      setError('Invalid amount');
      return;
    }

    const newAmountInNonaMas = fromMAS(amount);

    if (newAmountInNonaMas < MINIMAL_DEPOSIT) {
      setError(`Amount to low (min: ${toMAS(MINIMAL_DEPOSIT)} MAS)`);
      return;
    }

    if (newAmountInNonaMas + DEPOSIT_STORAGE_COST > fromMAS(balance || '0')) {
      setError('Insufficient balance (including storage cost)');
      return;
    }

    deposit(fromMAS(amount));
  }

  return (
    <div className="flex justify-between w-full items-stretch mb-4">
      <div className="flex flex-col w-2/3 mr-4">
        {isPending && opId ? (
          <div className="flex flex-row justify-between h-full items-center rounded-lg bg-secondary px-4">
            <div className="flex flex-row items-center">
              <Spinner customClass="mr-4" />
              <p className="mas-body">{Intl.t('steps.depositing')}</p>
            </div>
            <a
              href={generateExplorerLink(opId)}
              target="_blank"
              rel="noreferrer"
              className="mas-menu-underline"
            >
              Explorer
            </a>
          </div>
        ) : (
          <Money
            placeholder="Amount to deposit"
            value={amount}
            onValueChange={(event) => handleSetAmount(event.value)}
            error={error ? error : undefined}
          />
        )}
      </div>
      <Button
        onClick={handleSubmit}
        customClass="w-1/3"
        disabled={isPending && !!opId}
      >
        Start Blasting Session!
      </Button>
    </div>
  );
}
