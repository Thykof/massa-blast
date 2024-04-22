import { getClient, waitOp } from '../lib/utils';
import { config } from 'dotenv';
import { setWithdrawableFor } from '../lib/set-withdrawable-for';
config();

// inputs
const opId = '';
const amount = 0n;

// code
const { client, baseAccount } = await getClient(
  process.env.SECRET_KEY_FULLPOWER!,
);
const operationId = await setWithdrawableFor(
  client,
  baseAccount,
  process.env.ADDRESS_CONTRACT!,
  process.env.ADDRESS_USER_1!,
  opId,
  amount,
);
const { status, events } = await waitOp(client, operationId, false);
console.log(`operationId ${operationId} status: ${status}`);
events.map((l) => console.log(`Event: ${l.data}`));
