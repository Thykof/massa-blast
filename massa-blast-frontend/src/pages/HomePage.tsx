import { ConnectMassaWallet } from '../components/ConnectMassaWallets/ConnectMassaWallet';
import { useAccountStore } from '../store';
import { Card } from '../components/Card';
import { useReadBlastingSession } from '../utils/read-sc';
import { Deposit } from '../components/blasting/Deposit';
import { ActiveSession } from '../components/blasting/ActiveSession';
import { FAQ } from '../components/blasting/FAQ';

export default function HomePage() {
  const { connectedAccount, currentProvider, massaClient } = useAccountStore();

  const { session, refetch } = useReadBlastingSession(
    massaClient,
    connectedAccount?.address(),
  );

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
        <ActiveSession session={session} refetch={refetch} />
      </Card>
    );
  };

  return (
    <div className="sm:w-full md:max-w-4xl mx-auto">
      <div className="flex justify-between mb-2"></div>
      <div className="p-5">
        <section className="mb-4 p-2 text-center">
          <p className="mas-title mb-2 ">Massa Blast</p>
          <h4 className="mas-body">Stack your MAS without running a node!</h4>
          <p>
            <strong>
              The service has been stopped.{' '}
              <a href="Learn morehttps://github.com/Thykof/massa-blast/blob/main/end-of-service.md">
                Learn more
              </a>
            </strong>
          </p>
        </section>
        <section className="mb-10">
          <Card>
            <ConnectMassaWallet />
          </Card>
        </section>
        <section className="mb-10">{mainSection()}</section>
        <section className="mb-10">
          <Card>
            <h1 className="mas-subtitle text-center">FAQ</h1>
            <FAQ />
          </Card>
        </section>
      </div>
    </div>
  );
}
