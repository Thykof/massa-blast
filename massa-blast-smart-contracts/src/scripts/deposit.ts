import { getClient, waitOp } from '../lib/utils';
import { deposit } from '../lib/deposit';
import { fromMAS } from '@massalabs/web3-utils';
import { config } from 'dotenv';
config();

if (import.meta.url.startsWith('file:')) {
  const { client, baseAccount } = await getClient(
    process.env.SECRET_KEY_USER_1!,
  );
  const operationId = await deposit(
    client,
    baseAccount,
    fromMAS(10),
    process.env.ADDRESS_CONTRACT!,
  );
  const { status, events } = await waitOp(client, operationId, false);
  console.log(`operationId ${operationId} status: ${status}`);
  events.map((l) => console.log(`Event: ${l.data}`));
}
