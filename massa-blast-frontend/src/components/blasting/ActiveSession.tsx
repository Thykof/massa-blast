import { useAccountStore } from '../../store';
import { useReadWithdrawable } from '../../utils/read-sc';
import { useWrite } from '../../utils/write-sc';
import { Card } from '../Card';
import { formatAmount } from '../../utils/parseAmount';
import { msToDateTimeWithTimeZone } from '../../utils';
import { useEffect } from 'react';
import { Button, Spinner } from '@massalabs/react-ui-kit';
import { BlastingSession } from '../../types/BlastingSession';

export function ActiveSession(props: {
  session: BlastingSession;
  refetch: () => void;
}) {
  const { session, refetch } = props;
  const { connectedAccount, massaClient } = useAccountStore();

  const { withdrawable, refetch: refetchWithdrawable } = useReadWithdrawable(
    massaClient,
    connectedAccount?.address(),
  );
  const { opId, isPending, isSuccess, requestWithdraw, withdraw } =
    useWrite(massaClient);

  useEffect(() => {
    if (isSuccess) {
      refetch();
      refetchWithdrawable();
    }
  }, [isSuccess, refetch]);

  const subSection = () => {
    if (session?.withdrawRequestOpId === '') {
      return (
        <div>
          <Button
            onClick={requestWithdraw}
            customClass="w-1/3"
            disabled={isPending && !!opId}
          >
            {isPending && !!opId && <Spinner customClass="mr-4" />}
            Request withdraw
          </Button>
        </div>
      );
    }

    if (withdrawable && withdrawable > BigInt(0)) {
      return (
        <div>
          <Button
            onClick={withdraw}
            customClass="w-1/3"
            disabled={isPending && !!opId}
          >
            {isPending && !!opId && <Spinner customClass="mr-4" />}
            Withdraw
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-row items-center">
        <Spinner customClass="mr-4" />
        <p className="mas-body">Withdraw request is pending</p>
      </div>
    );
  };

  if (session === undefined) {
    return 'No session found.';
  }

  return (
    <Card customClass="pb-0 mb-4">
      <div className="flex justify-between items-center mb-2"></div>
      <div className="mb-4">
        <p className="mas-body">
          Total amount:{' '}
          {formatAmount(session.amount.toString()).amountFormattedFull} MAS
        </p>
        <p className="mas-body">
          Started at: {msToDateTimeWithTimeZone(Number(session.startTimestamp))}
        </p>
        {!!withdrawable && (
          <p className="mas-body">
            Withdrawable:{' '}
            {formatAmount(withdrawable.toString()).amountFormattedFull} MAS
          </p>
        )}
      </div>
      <section className="mb-10">{subSection()}</section>
    </Card>
  );
}
