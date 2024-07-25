import { Args, bytesToStr } from '@massalabs/massa-web3';
import { BlastingSession } from '../lib/BlastingSession';
import { getClient } from '../lib/utils';

import { config } from 'dotenv';
config();

const contractAddress = process.env.ADDRESS_CONTRACT!;

const { client } = await getClient(process.env.SECRET_KEY_FULLPOWER!);

const addressInfo = await client.publicApi().getAddresses([contractAddress]);
const keys = addressInfo[0].candidate_datastore_keys;
for (const k of keys) {
  const key = Uint8Array.from(k);
  const keyString = bytesToStr(key);
  if (keyString.startsWith('BlastingSession')) {
    const address = keyString.split('_')[1];
    const entry = await client.publicApi().getDatastoreEntries([
      {
        address: contractAddress,
        key: key,
      },
    ]);
    const value = entry[0].candidate_value;
    if (!value) {
      continue;
    }
    const session = new Args(value).nextSerializable<BlastingSession>(
      BlastingSession,
    );
    console.log(session);
  }
}
