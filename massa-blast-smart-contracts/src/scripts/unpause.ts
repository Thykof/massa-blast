import { getClient, waitOp } from '../lib/utils';
import { config } from 'dotenv';
import { unpause } from '../lib/pause';
config();

const { client, baseAccount } = await getClient(
  process.env.SECRET_KEY_FULLPOWER!,
);
const operationId = await unpause(
  client,
  baseAccount,
  process.env.ADDRESS_CONTRACT!,
);
const { status, events } = await waitOp(client, operationId, false);
console.log(`operationId ${operationId} status: ${status}`);
events.map((l) => console.log(`Event: ${l.data}`));
