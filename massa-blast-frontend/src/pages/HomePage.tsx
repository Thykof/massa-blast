import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';
import { useAccountStore } from '../store';
import { Card } from '../components/Card';
import { useReadBlastingSession, useTotalAmount } from '../utils/read-sc';
import { Deposit } from '../components/blasting/Deposit';
import { ActiveSession } from '../components/blasting/ActiveSession';

export default function HomePage() {
  const { connectedAccount, currentProvider, massaClient } = useAccountStore();

  const { session, refetch } = useReadBlastingSession(
    massaClient,
    connectedAccount?.address(),
  );
  const { totalAmount } = useTotalAmount(massaClient);

  const connected = !!connectedAccount && !!currentProvider;

  const mainSection = () => {
    if (!connected) {
      return (
        <Card>
          <h3 className="mas-h3">Connect a wallet to start.</h3>
        </Card>
      );
    }

    if (!session) {
      return (
        <Card>
          <Deposit refetch={refetch} />
        </Card>
      );
    }

    return (
      <Card>
        <ActiveSession />
      </Card>
    );
  };

  return (
    <div className="sm:w-full md:max-w-4xl mx-auto">
      <div className="flex justify-between mb-2"></div>
      <div className="p-5">
        <section className="mb-4 p-2">
          <p className="mas-title mb-2 text-center">Massa Blast</p>
          <h4 className="mas-body">Stack your MAS without running a node!</h4>
          {totalAmount && <p>{totalAmount} MAS is already blasting!</p>}
        </section>
        <section className="mb-10">
          <Card>
            <ConnectMassaWallet />
          </Card>
        </section>
        <section className="mb-10">{mainSection()}</section>
      </div>
    </div>
  );
}
